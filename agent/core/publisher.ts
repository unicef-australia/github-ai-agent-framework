import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadAgentConfig } from "../config/load.js";
import {
  validateRequiredCommandKinds,
  type AgentConfig,
} from "../config/schema.js";
import { RepositoryTools } from "../tools/repository-tools.js";
import type { ToolResult } from "../tools/types.js";
import {
  implementationReportSchema,
  publisherVerificationSchema,
  type ImplementationReport,
  type PublisherVerification,
} from "../validation/artifacts.js";
import { validatePatch } from "../validation/patch.js";
import { capturePatch, requireCleanRepository, runGit } from "./git.js";

const MAX_BUNDLE_FILE_BYTES = 5_000_000;

export interface BundleSource {
  readonly patch: string;
  readonly report: unknown;
  readonly prBody: string;
}

export interface ExpectedBundleIdentity {
  readonly repository: string;
  readonly issue_number: number;
}

function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

export function validateImplementationBundle(
  source: BundleSource,
  config: AgentConfig,
  expected: ExpectedBundleIdentity,
): { readonly report: ImplementationReport } {
  const report = implementationReportSchema.parse(source.report);
  if (
    report.repository !== expected.repository ||
    report.issue_number !== expected.issue_number
  ) {
    throw new Error(
      "Implementation report does not match the trusted repository and issue",
    );
  }
  if (source.prBody.length === 0 || source.prBody.length > 30_000) {
    throw new Error("Pull request body is empty or too large");
  }
  const validatedPatch = validatePatch(source.patch, config);
  if (validatedPatch.sha256 !== report.patch.sha256) {
    throw new Error(
      "Patch digest does not match the tested implementation report",
    );
  }
  if (validatedPatch.lines !== report.patch.lines) {
    throw new Error(
      "Patch line count does not match the implementation report",
    );
  }
  if (!sameStrings(validatedPatch.changed_files, report.changed_files)) {
    throw new Error("Patch paths do not match the implementation report");
  }
  const policy = config.limits;
  if (
    report.policy.max_changed_files !== policy.max_changed_files ||
    report.policy.max_patch_lines !== policy.max_patch_lines ||
    report.policy.allow_dependency_changes !==
      policy.allow_dependency_changes ||
    report.policy.allow_workflow_changes !== policy.allow_workflow_changes
  ) {
    throw new Error(
      "Implementation report policy does not match repository policy",
    );
  }
  const required = config.commands.filter((command) => command.required);
  validateRequiredCommandKinds(config);
  for (const command of required) {
    const result = report.verification.commands.find(
      (candidate) => candidate.name === command.name,
    );
    if (
      !result ||
      result.run !== command.run ||
      result.kind !== command.kind ||
      result.exit_code !== 0
    ) {
      throw new Error(
        `Required command was not successfully reported: ${command.name}`,
      );
    }
  }
  return { report };
}

async function readBounded(path: string): Promise<string> {
  const details = await stat(path);
  if (details.size > MAX_BUNDLE_FILE_BYTES) {
    throw new Error(`Bundle file exceeds 5 MB: ${path}`);
  }
  return readFile(path, "utf8");
}

async function readBundle(directory: string): Promise<{
  readonly source: BundleSource;
  readonly rawReport: string;
}> {
  const [patch, rawReport, prBody] = await Promise.all([
    readBounded(resolve(directory, "implementation.patch")),
    readBounded(resolve(directory, "report.json")),
    readBounded(resolve(directory, "pr-body.md")),
  ]);
  return {
    source: {
      patch,
      report: JSON.parse(rawReport) as unknown,
      prBody,
    },
    rawReport,
  };
}

function reportCommand(
  result: ToolResult,
): PublisherVerification["commands"][number] {
  if (
    !result.ok ||
    !result.command ||
    result.exit_code !== 0 ||
    result.duration_ms === undefined
  ) {
    throw new Error("Publisher verification command did not pass");
  }
  return {
    name: result.command.name,
    kind: result.command.kind,
    run: result.command.run,
    exit_code: 0,
    duration_ms: result.duration_ms,
    output: result.output,
  };
}

export async function verifyImplementationBundle(options: {
  readonly repositoryRoot: string;
  readonly bundleDirectory: string;
  readonly outputPath: string;
  readonly expected: ExpectedBundleIdentity;
  readonly now?: () => Date;
}): Promise<PublisherVerification> {
  const config = await loadAgentConfig(options.repositoryRoot);
  const baseSha = await requireCleanRepository(options.repositoryRoot);
  const bundle = await readBundle(options.bundleDirectory);
  const validated = validateImplementationBundle(
    bundle.source,
    config,
    options.expected,
  );
  if (validated.report.base_sha !== baseSha) {
    throw new Error(
      "Checked-out commit does not match the implementation base SHA",
    );
  }
  const applyCheck = await runGit(
    options.repositoryRoot,
    ["apply", "--check", "--whitespace=error", "-"],
    bundle.source.patch,
  );
  if (applyCheck.code !== 0) {
    throw new Error(
      `Patch cannot be applied: ${applyCheck.stderr.toString("utf8")}`,
    );
  }
  const apply = await runGit(
    options.repositoryRoot,
    ["apply", "--whitespace=error", "-"],
    bundle.source.patch,
  );
  if (apply.code !== 0) {
    throw new Error(
      `Patch application failed: ${apply.stderr.toString("utf8")}`,
    );
  }
  const tools = new RepositoryTools(
    options.repositoryRoot,
    config,
    process.env,
  );
  const results = await tools.runRequiredCommands();
  if (results.some((result) => !result.ok)) {
    throw new Error("Publisher re-verification failed required commands");
  }
  const recaptured = await capturePatch(options.repositoryRoot);
  const recapturedValidation = validatePatch(recaptured.patch, config);
  if (recapturedValidation.sha256 !== validated.report.patch.sha256) {
    throw new Error("Required commands changed the tested patch");
  }
  const verification = publisherVerificationSchema.parse({
    schema_version: 1,
    repository: options.expected.repository,
    issue_number: options.expected.issue_number,
    base_sha: baseSha,
    patch_sha256: validated.report.patch.sha256,
    report_sha256: sha256(bundle.rawReport),
    verified_at: (options.now ?? (() => new Date()))().toISOString(),
    passed: true,
    commands: results.map(reportCommand),
  });
  await mkdir(resolve(options.outputPath, ".."), { recursive: true });
  await writeFile(
    resolve(options.outputPath),
    `${JSON.stringify(verification, null, 2)}\n`,
  );
  return verification;
}

export async function validateBundleForPublish(options: {
  readonly repositoryRoot: string;
  readonly bundleDirectory: string;
  readonly verificationPath: string;
  readonly outputPath: string;
  readonly expected: ExpectedBundleIdentity;
}): Promise<{
  readonly base_sha: string;
  readonly branch: string;
  readonly pr_title: string;
}> {
  const config = await loadAgentConfig(options.repositoryRoot);
  const baseSha = await requireCleanRepository(options.repositoryRoot);
  const bundle = await readBundle(options.bundleDirectory);
  const validated = validateImplementationBundle(
    bundle.source,
    config,
    options.expected,
  );
  const verification = publisherVerificationSchema.parse(
    JSON.parse(await readBounded(options.verificationPath)) as unknown,
  );
  if (
    verification.repository !== options.expected.repository ||
    verification.issue_number !== options.expected.issue_number ||
    verification.base_sha !== baseSha ||
    verification.base_sha !== validated.report.base_sha ||
    verification.patch_sha256 !== validated.report.patch.sha256 ||
    verification.report_sha256 !== sha256(bundle.rawReport)
  ) {
    throw new Error("Publisher verification does not match the current bundle");
  }
  const requiredNames = config.commands
    .filter((command) => command.required)
    .map((command) => command.name);
  if (
    !requiredNames.every((name) =>
      verification.commands.some((item) => item.name === name),
    )
  ) {
    throw new Error("Publisher verification is missing a required command");
  }
  const applyCheck = await runGit(
    options.repositoryRoot,
    ["apply", "--check", "--whitespace=error", "-"],
    bundle.source.patch,
  );
  if (applyCheck.code !== 0) {
    throw new Error(
      `Verified patch no longer applies: ${applyCheck.stderr.toString("utf8")}`,
    );
  }
  const metadata = {
    base_sha: baseSha,
    branch: `agent/issue-${options.expected.issue_number}-${validated.report.patch.sha256.slice(0, 12)}`,
    pr_title: validated.report.pr_title,
  };
  await writeFile(
    resolve(options.outputPath),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  return metadata;
}

export function inspectImplementationReport(
  value: unknown,
  expected: ExpectedBundleIdentity,
): { readonly base_sha: string } {
  const report = implementationReportSchema.parse(value);
  if (
    report.repository !== expected.repository ||
    report.issue_number !== expected.issue_number
  ) {
    throw new Error(
      "Implementation report identity does not match requested publication",
    );
  }
  return { base_sha: report.base_sha };
}

export function inspectPublisherVerification(
  value: unknown,
  expected: ExpectedBundleIdentity,
): { readonly base_sha: string } {
  const verification = publisherVerificationSchema.parse(value);
  if (
    verification.repository !== expected.repository ||
    verification.issue_number !== expected.issue_number
  ) {
    throw new Error(
      "Publisher verification identity does not match requested publication",
    );
  }
  return { base_sha: verification.base_sha };
}
