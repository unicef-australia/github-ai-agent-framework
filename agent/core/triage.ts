import { loadAgentConfig } from "../config/load.js";
import { createProvider } from "../providers/registry.js";
import type { AIProvider } from "../types.js";
import type { IssueContext } from "../validation/events.js";
import type { TriageArtifact } from "../validation/artifacts.js";
import {
  formatTriageComment,
  parseTriageResult,
} from "../validation/triage.js";
import {
  collectRepositoryContext,
  formatRepositoryContext,
} from "./context.js";
import { loadPrompt } from "./prompts.js";

export interface RunTriageOptions {
  readonly repositoryRoot: string;
  readonly repository: string;
  readonly issue: IssueContext;
  readonly provider?: AIProvider;
  readonly now?: () => Date;
}

export async function runTriage(
  options: RunTriageOptions,
): Promise<TriageArtifact> {
  const config = await loadAgentConfig(options.repositoryRoot);
  const provider =
    options.provider ?? createProvider(config.triage.provider, process.env);
  const [prompt, contextFiles] = await Promise.all([
    loadPrompt("triage.md"),
    collectRepositoryContext(options.repositoryRoot, config),
  ]);
  const response = await provider.chat({
    model: config.triage.model,
    max_tokens: config.triage.max_tokens,
    temperature: config.triage.temperature,
    response_format: "json",
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: [
          "Analyse this issue using the repository context below.",
          `\nISSUE\n${JSON.stringify(options.issue, null, 2)}`,
          `\nREPOSITORY CONTEXT\n${formatRepositoryContext(contextFiles)}`,
        ].join("\n"),
      },
    ],
  });
  const result = parseTriageResult(response.content);
  const allOutcomeLabels = [
    "needs-discussion",
    "ready-for-agent",
    "wontfix",
  ] as const;
  return {
    schema_version: 1,
    repository: options.repository,
    issue_number: options.issue.number,
    generated_at: (options.now ?? (() => new Date()))().toISOString(),
    provider: provider.name,
    model: response.model ?? config.triage.model,
    result,
    comment: formatTriageComment(result),
    labels: {
      add: [result.decision],
      remove: [
        "needs-agent-triage",
        ...allOutcomeLabels.filter((label) => label !== result.decision),
      ],
    },
  };
}
