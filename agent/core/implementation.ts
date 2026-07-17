import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadAgentConfig } from "../config/load.js";
import { createProvider } from "../providers/registry.js";
import { RepositoryTools } from "../tools/repository-tools.js";
import type { ToolResult } from "../tools/types.js";
import type { AIProvider, ChatMessage } from "../types.js";
import {
  implementationReportSchema,
  type ImplementationReport,
} from "../validation/artifacts.js";
import type { IssueContext } from "../validation/events.js";
import {
  parseImplementationAction,
  parseImplementationPlan,
} from "../validation/implementation.js";
import { validatePatch } from "../validation/patch.js";
import {
  collectRepositoryContext,
  formatRepositoryContext,
} from "./context.js";
import { capturePatch, requireCleanRepository } from "./git.js";
import { loadPrompt } from "./prompts.js";

export interface RunImplementationOptions {
  readonly repositoryRoot: string;
  readonly outputDirectory: string;
  readonly repository: string;
  readonly issue: IssueContext;
  readonly provider?: AIProvider;
  readonly now?: () => Date;
}

function protocolDescription(
  commands: readonly { readonly name: string; readonly kind: string }[],
): string {
  return `
Return exactly one JSON object per turn.

Tool requests:
{"type":"tool","tool":"read_file","input":{"path":"relative/path"}}
{"type":"tool","tool":"list_directory","input":{"path":"relative/path"}}
{"type":"tool","tool":"search_code","input":{"query":"literal","path":"relative/path"}}
{"type":"tool","tool":"write_file","input":{"path":"relative/path","content":"complete file content"}}
{"type":"tool","tool":"run_command","input":{"name":"allow-listed-name"}}

Final response:
{"type":"final","summary":"...","pr_title":"...","pr_body":"...","testing_notes":["..."],"risks":["..."]}

Allow-listed commands: ${JSON.stringify(commands)}
There is no raw command or shell tool. write_file always replaces the complete file.
`;
}

function verificationSummary(results: readonly ToolResult[]): string {
  return JSON.stringify(
    results.map((result) => ({
      name: result.command?.name,
      ok: result.ok,
      exit_code: result.exit_code,
      output: result.output,
    })),
  );
}

function reportCommand(result: ToolResult): {
  name: string;
  kind: string;
  run: string;
  exit_code: number;
  duration_ms: number;
  output: string;
} {
  if (
    !result.command ||
    result.exit_code === undefined ||
    result.duration_ms === undefined
  ) {
    throw new Error("Verification result is missing command metadata");
  }
  return {
    name: result.command.name,
    kind: result.command.kind,
    run: result.command.run,
    exit_code: result.exit_code,
    duration_ms: result.duration_ms,
    output: result.output,
  };
}

export async function runImplementation(
  options: RunImplementationOptions,
): Promise<ImplementationReport> {
  if (!options.issue.labels.includes("agent-approved")) {
    throw new Error(
      "Implementation requires the human-applied agent-approved label",
    );
  }
  const config = await loadAgentConfig(options.repositoryRoot);
  if (
    !config.commands.some(
      (command) => command.required && command.kind === "test",
    )
  ) {
    throw new Error("At least one required test command must be configured");
  }
  const agentsPath = resolve(options.repositoryRoot, "AGENTS.md");
  let agentsInstructions: string;
  try {
    agentsInstructions = await readFile(agentsPath, "utf8");
  } catch (error) {
    throw new Error("AGENTS.md is required before implementation", {
      cause: error,
    });
  }

  const baseSha = await requireCleanRepository(options.repositoryRoot);
  const provider =
    options.provider ??
    createProvider(config.implementation.provider, process.env);
  const tools = new RepositoryTools(
    options.repositoryRoot,
    config,
    process.env,
  );
  const [prompt, contextFiles] = await Promise.all([
    loadPrompt("implementation.md"),
    collectRepositoryContext(options.repositoryRoot, config),
  ]);
  const system = `${prompt}\n${protocolDescription(config.commands)}\nPOLICY\n${JSON.stringify(config.limits)}`;
  const issueAndContext = [
    `ISSUE\n${JSON.stringify(options.issue, null, 2)}`,
    `AGENTS.md\n${agentsInstructions}`,
    `REPOSITORY CONTEXT\n${formatRepositoryContext(contextFiles)}`,
  ].join("\n\n");
  const planResponse = await provider.chat({
    model: config.implementation.model,
    max_tokens: config.implementation.max_tokens,
    temperature: config.implementation.temperature,
    response_format: "json",
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `${issueAndContext}\n\nReturn a plan object with schema_version, summary, steps, files_to_inspect, and tests. Do not use tools yet.`,
      },
    ],
  });
  const plan = parseImplementationPlan(planResponse.content);
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: issueAndContext },
    { role: "assistant", content: JSON.stringify(plan) },
    {
      role: "user",
      content:
        "Execute the approved plan now. Return one tool request at a time, then a final response.",
    },
  ];

  for (let step = 0; step < config.implementation.max_steps; step += 1) {
    const response = await provider.chat({
      model: config.implementation.model,
      max_tokens: config.implementation.max_tokens,
      temperature: config.implementation.temperature,
      response_format: "json",
      messages,
    });
    const action = parseImplementationAction(response.content);
    messages.push({ role: "assistant", content: response.content });

    if (action.type === "tool") {
      try {
        const result = await tools.execute(action);
        messages.push({ role: "user", content: JSON.stringify(result) });
      } catch (error) {
        messages.push({
          role: "user",
          content: JSON.stringify({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        });
      }
      continue;
    }

    const verification = await tools.runRequiredCommands();
    if (verification.some((result) => !result.ok)) {
      messages.push({
        role: "user",
        content: `Required verification failed. Fix the repository and try again. Results: ${verificationSummary(verification)}`,
      });
      continue;
    }

    const { patch, changedFiles } = await capturePatch(options.repositoryRoot);
    const validatedPatch = validatePatch(patch, config);
    if (
      JSON.stringify([...validatedPatch.changed_files].sort()) !==
      JSON.stringify([...changedFiles].sort())
    ) {
      throw new Error("Patch headers do not match Git's changed-file list");
    }
    const prBody = [
      action.pr_body,
      "",
      `Closes #${options.issue.number}`,
      "",
      "---",
      "Generated by GitHub AI Agent Framework. Human review and merge are required.",
    ].join("\n");
    const report = implementationReportSchema.parse({
      schema_version: 1,
      repository: options.repository,
      issue_number: options.issue.number,
      base_sha: baseSha,
      generated_at: (options.now ?? (() => new Date()))().toISOString(),
      provider: provider.name,
      model: response.model ?? config.implementation.model,
      pr_title: action.pr_title,
      summary: action.summary,
      plan,
      changed_files: validatedPatch.changed_files,
      patch: {
        sha256: validatedPatch.sha256,
        lines: validatedPatch.lines,
      },
      verification: {
        passed: true,
        commands: verification.map(reportCommand),
      },
      policy: {
        max_changed_files: config.limits.max_changed_files,
        max_patch_lines: config.limits.max_patch_lines,
        allow_dependency_changes: config.limits.allow_dependency_changes,
        allow_workflow_changes: config.limits.allow_workflow_changes,
      },
      testing_notes: action.testing_notes,
      risks: action.risks,
    });
    await mkdir(resolve(options.outputDirectory), { recursive: true });
    await Promise.all([
      writeFile(
        resolve(options.outputDirectory, "implementation.patch"),
        patch,
      ),
      writeFile(resolve(options.outputDirectory, "pr-body.md"), prBody),
      writeFile(
        resolve(options.outputDirectory, "report.json"),
        `${JSON.stringify(report, null, 2)}\n`,
      ),
    ]);
    return report;
  }
  throw new Error(
    `Implementation did not complete within ${config.implementation.max_steps} model steps`,
  );
}
