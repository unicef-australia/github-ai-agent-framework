import { z } from "zod";

import { triageResultSchema } from "./triage.js";

const trustedTriageLabels = z.enum([
  "needs-agent-triage",
  "needs-discussion",
  "ready-for-agent",
  "wontfix",
]);

export const triageArtifactSchema = z
  .object({
    schema_version: z.literal(1),
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    issue_number: z.number().int().positive(),
    generated_at: z.iso.datetime(),
    provider: z.string().min(1),
    model: z.string().min(1),
    result: triageResultSchema,
    comment: z.string().min(1).max(20_000),
    labels: z
      .object({
        add: z.array(trustedTriageLabels).max(1),
        remove: z.array(trustedTriageLabels).max(4),
      })
      .strict(),
  })
  .strict();

export type TriageArtifact = z.infer<typeof triageArtifactSchema>;

export function validateTriageArtifact(
  value: unknown,
  expected: { readonly repository: string; readonly issue_number: number },
): TriageArtifact {
  const artifact = triageArtifactSchema.parse(value);
  if (
    artifact.repository !== expected.repository ||
    artifact.issue_number !== expected.issue_number
  ) {
    throw new Error(
      "Triage artifact does not match the trusted repository and issue",
    );
  }
  if (artifact.labels.add[0] !== artifact.result.decision) {
    throw new Error(
      "Triage artifact label does not match its validated decision",
    );
  }
  return artifact;
}
