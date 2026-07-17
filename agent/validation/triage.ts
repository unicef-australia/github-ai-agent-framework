import { z } from "zod";

import { parseJsonObject } from "./json.js";

export const triageDecisionSchema = z.enum([
  "needs-discussion",
  "ready-for-agent",
  "wontfix",
]);

export const triageResultSchema = z
  .object({
    schema_version: z.literal(1),
    decision: triageDecisionSchema,
    summary: z.string().trim().min(1).max(2_000),
    reasoning: z.array(z.string().trim().min(1).max(1_000)).max(10),
    missing_information: z.array(z.string().trim().min(1).max(1_000)).max(10),
    implementation_outline: z
      .array(z.string().trim().min(1).max(1_000))
      .max(15),
  })
  .strict();

export type TriageResult = z.infer<typeof triageResultSchema>;

export function parseTriageResult(source: string): TriageResult {
  const parsed = triageResultSchema.safeParse(parseJsonObject(source));
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid triage result: ${details}`);
  }
  return parsed.data;
}

function bulletSection(title: string, items: readonly string[]): string {
  if (items.length === 0) return "";
  return `\n\n### ${title}\n\n${items.map((item) => `- ${item}`).join("\n")}`;
}

export function formatTriageComment(result: TriageResult): string {
  const decision = result.decision
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
  return [
    "<!-- github-ai-agent-framework:triage -->",
    "## AI issue triage",
    "",
    `**Decision:** ${decision}`,
    "",
    result.summary,
    bulletSection("Reasoning", result.reasoning),
    bulletSection("Missing information", result.missing_information),
    bulletSection("Implementation outline", result.implementation_outline),
    "\n\n_This analysis is advisory. A human must add `agent-approved` before implementation._",
  ].join("\n");
}
