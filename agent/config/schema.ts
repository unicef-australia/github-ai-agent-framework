import { z } from "zod";

const providerStageSchema = z
  .object({
    provider: z.string().trim().min(1),
    model: z.string().trim().min(1),
    max_tokens: z.number().int().positive().max(65_536).default(8_192),
    temperature: z.number().min(0).max(2).default(0),
  })
  .strict();

const implementationStageSchema = providerStageSchema.extend({
  max_steps: z.number().int().positive().max(100).default(40),
});

export const commandSchema = z
  .object({
    name: z.string().regex(/^[a-z][a-z0-9_-]*$/),
    kind: z.enum(["install", "format", "lint", "test", "build", "custom"]),
    run: z.string().trim().min(1).max(500),
    required: z.boolean().default(true),
    timeout_minutes: z.number().int().positive().max(30).default(10),
  })
  .strict();

export const agentConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    triage: providerStageSchema,
    implementation: implementationStageSchema,
    review: providerStageSchema,
    limits: z
      .object({
        max_changed_files: z.number().int().positive().max(100).default(8),
        max_patch_lines: z.number().int().positive().max(20_000).default(1_500),
        allow_dependency_changes: z.boolean().default(false),
        allow_workflow_changes: z.boolean().default(false),
        protected_paths: z
          .array(z.string().trim().min(1))
          .default([
            ".github/workflows/",
            ".github/agent.yml",
            "AGENTS.md",
            "*/AGENTS.md",
            ".env",
            ".env.*",
            ".git",
          ]),
      })
      .strict(),
    commands: z.array(commandSchema).default([]),
    context: z
      .object({
        include: z
          .array(z.string().trim().min(1))
          .default(["AGENTS.md", "CONTEXT.md", "README.md", "docs/"]),
        max_bytes: z.number().int().positive().max(2_000_000).default(250_000),
      })
      .strict()
      .default({
        include: ["AGENTS.md", "CONTEXT.md", "README.md", "docs/"],
        max_bytes: 250_000,
      }),
  })
  .strict();

export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type AgentCommand = z.infer<typeof commandSchema>;
export type ProviderStageConfig = z.infer<typeof providerStageSchema>;

export function validateRequiredCommandKinds(config: AgentConfig): void {
  const requiredKinds = new Set(
    config.commands
      .filter((command) => command.required)
      .map((command) => command.kind),
  );
  const required = ["format", "lint", "test"] as const;
  const missing = required.filter((kind) => !requiredKinds.has(kind));
  if (missing.length > 0) {
    throw new Error(
      `Required command kinds are missing: ${missing.join(", ")}`,
    );
  }
}
