#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { runTriage } from "./core/triage.js";
import { runImplementation } from "./core/implementation.js";
import {
  inspectImplementationReport,
  inspectPublisherVerification,
  validateBundleForPublish,
  verifyImplementationBundle,
} from "./core/publisher.js";
import { createProvider } from "./providers/registry.js";
import { loadAgentConfig } from "./config/load.js";
import { issueContextFromEvent } from "./validation/events.js";
import { validateTriageArtifact } from "./validation/artifacts.js";
import { installFramework } from "./install.js";

interface Arguments {
  readonly command: string;
  readonly options: Readonly<Record<string, string>>;
}

function parseArguments(argv: readonly string[]): Arguments {
  const [command, ...rest] = argv;
  if (!command) throw new Error("A command is required");
  const options: Record<string, string> = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument near ${key ?? "end of command"}`);
    }
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function required(
  options: Readonly<Record<string, string>>,
  key: string,
): string {
  const value = options[key];
  if (!value) throw new Error(`--${key} is required`);
  return value;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function triage(
  options: Readonly<Record<string, string>>,
): Promise<void> {
  const repositoryRoot = resolve(required(options, "repo"));
  const event = issueContextFromEvent(
    await readJson(required(options, "event")),
  );
  const repository = options.repository ?? event.repository;
  if (!repository)
    throw new Error("--repository is required when absent from event");
  const config = await loadAgentConfig(repositoryRoot);
  const provider = createProvider(config.triage.provider, process.env);
  const artifact = await runTriage({
    repositoryRoot,
    repository,
    issue: event.issue,
    provider,
  });
  await writeJson(required(options, "output"), artifact);
}

async function validateTriage(
  options: Readonly<Record<string, string>>,
): Promise<void> {
  const repository = required(options, "repository");
  const issueNumber = Number(required(options, "issue-number"));
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
    throw new Error("--issue-number must be a positive integer");
  }
  const artifact = validateTriageArtifact(
    await readJson(required(options, "input")),
    { repository, issue_number: issueNumber },
  );
  await writeJson(required(options, "output"), artifact);
}

async function implement(
  options: Readonly<Record<string, string>>,
): Promise<void> {
  const repositoryRoot = resolve(required(options, "repo"));
  const event = issueContextFromEvent(
    await readJson(required(options, "event")),
  );
  const repository = options.repository ?? event.repository;
  if (!repository)
    throw new Error("--repository is required when absent from event");
  await runImplementation({
    repositoryRoot,
    outputDirectory: resolve(required(options, "output")),
    repository,
    issue: event.issue,
  });
}

function expectedIdentity(options: Readonly<Record<string, string>>): {
  repository: string;
  issue_number: number;
} {
  const repository = required(options, "repository");
  const issueNumber = Number(required(options, "issue-number"));
  if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
    throw new Error("--issue-number must be a positive integer");
  }
  return { repository, issue_number: issueNumber };
}

async function inspectReport(
  options: Readonly<Record<string, string>>,
): Promise<void> {
  await writeJson(
    required(options, "output"),
    inspectImplementationReport(
      await readJson(required(options, "input")),
      expectedIdentity(options),
    ),
  );
}

async function verifyBundle(
  options: Readonly<Record<string, string>>,
): Promise<void> {
  await verifyImplementationBundle({
    repositoryRoot: resolve(required(options, "repo")),
    bundleDirectory: resolve(required(options, "bundle")),
    outputPath: resolve(required(options, "output")),
    expected: expectedIdentity(options),
  });
}

async function inspectVerification(
  options: Readonly<Record<string, string>>,
): Promise<void> {
  await writeJson(
    required(options, "output"),
    inspectPublisherVerification(
      await readJson(required(options, "input")),
      expectedIdentity(options),
    ),
  );
}

async function validatePublish(
  options: Readonly<Record<string, string>>,
): Promise<void> {
  await validateBundleForPublish({
    repositoryRoot: resolve(required(options, "repo")),
    bundleDirectory: resolve(required(options, "bundle")),
    verificationPath: resolve(required(options, "verification")),
    outputPath: resolve(required(options, "output")),
    expected: expectedIdentity(options),
  });
}

async function install(
  options: Readonly<Record<string, string>>,
): Promise<void> {
  const results = await installFramework({
    target: options.target ?? ".",
    frameworkRef: options["framework-ref"] ?? "main",
    force: options.force === "true",
  });
  console.log(JSON.stringify(results, null, 2));
}

async function main(): Promise<void> {
  const { command, options } = parseArguments(process.argv.slice(2));
  switch (command) {
    case "install":
      await install(options);
      break;
    case "triage":
      await triage(options);
      break;
    case "implement":
      await implement(options);
      break;
    case "validate-triage":
      await validateTriage(options);
      break;
    case "inspect-report":
      await inspectReport(options);
      break;
    case "verify-bundle":
      await verifyBundle(options);
      break;
    case "inspect-verification":
      await inspectVerification(options);
      break;
    case "validate-publish":
      await validatePublish(options);
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
