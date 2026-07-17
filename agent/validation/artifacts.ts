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

export const implementationReportSchema = z
  .object({
    schema_version: z.literal(1),
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    issue_number: z.number().int().positive(),
    base_sha: z.string().regex(/^[0-9a-f]{40}$/),
    generated_at: z.iso.datetime(),
    provider: z.string().min(1),
    model: z.string().min(1),
    pr_title: z.string().min(1).max(200),
    summary: z.string().min(1).max(4_000),
    plan: z.object({
      schema_version: z.literal(1),
      summary: z.string(),
      steps: z.array(z.string()),
      files_to_inspect: z.array(z.string()),
      tests: z.array(z.string()),
    }),
    changed_files: z.array(z.string()).min(1),
    patch: z.object({
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      lines: z.number().int().positive(),
    }),
    verification: z.object({
      passed: z.literal(true),
      commands: z.array(
        z.object({
          name: z.string(),
          kind: z.string(),
          run: z.string(),
          exit_code: z.number().int(),
          duration_ms: z.number().nonnegative(),
          output: z.string(),
        }),
      ),
    }),
    policy: z.object({
      max_changed_files: z.number().int().positive(),
      max_patch_lines: z.number().int().positive(),
      allow_dependency_changes: z.boolean(),
      allow_workflow_changes: z.boolean(),
    }),
    testing_notes: z.array(z.string()),
    risks: z.array(z.string()),
  })
  .strict();

export type ImplementationReport = z.infer<typeof implementationReportSchema>;

export const publisherVerificationSchema = z
  .object({
    schema_version: z.literal(1),
    repository: z.string().regex(/^[^/]+\/[^/]+$/),
    issue_number: z.number().int().positive(),
    base_sha: z.string().regex(/^[0-9a-f]{40}$/),
    patch_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    report_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    verified_at: z.iso.datetime(),
    passed: z.literal(true),
    commands: z.array(
      z.object({
        name: z.string(),
        kind: z.string(),
        run: z.string(),
        exit_code: z.literal(0),
        duration_ms: z.number().nonnegative(),
        output: z.string(),
      }),
    ),
  })
  .strict();

export type PublisherVerification = z.infer<typeof publisherVerificationSchema>;
