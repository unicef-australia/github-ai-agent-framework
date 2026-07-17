import { z } from "zod";

import { parseJsonObject } from "./json.js";

export const implementationPlanSchema = z
  .object({
    schema_version: z.literal(1),
    summary: z.string().trim().min(1).max(2_000),
    steps: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20),
    files_to_inspect: z.array(z.string().trim().min(1).max(500)).max(30),
    tests: z.array(z.string().trim().min(1).max(1_000)).min(1).max(20),
  })
  .strict();

const readFileActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("read_file"),
    input: z.object({ path: z.string().min(1).max(500) }).strict(),
  })
  .strict();

const listDirectoryActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("list_directory"),
    input: z.object({ path: z.string().min(1).max(500) }).strict(),
  })
  .strict();

const searchCodeActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("search_code"),
    input: z
      .object({
        query: z.string().min(1).max(500),
        path: z.string().min(1).max(500).default("."),
      })
      .strict(),
  })
  .strict();

const writeFileActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("write_file"),
    input: z
      .object({
        path: z.string().min(1).max(500),
        content: z.string().max(500_000),
      })
      .strict(),
  })
  .strict();

const runCommandActionSchema = z
  .object({
    type: z.literal("tool"),
    tool: z.literal("run_command"),
    input: z.object({ name: z.string().min(1).max(100) }).strict(),
  })
  .strict();

export const toolActionSchema = z.discriminatedUnion("tool", [
  readFileActionSchema,
  listDirectoryActionSchema,
  searchCodeActionSchema,
  writeFileActionSchema,
  runCommandActionSchema,
]);

export const finalImplementationActionSchema = z
  .object({
    type: z.literal("final"),
    summary: z.string().trim().min(1).max(4_000),
    pr_title: z.string().trim().min(1).max(200),
    pr_body: z.string().trim().min(1).max(20_000),
    testing_notes: z.array(z.string().trim().min(1).max(1_000)).max(20),
    risks: z.array(z.string().trim().min(1).max(1_000)).max(20),
  })
  .strict();

export const implementationActionSchema = z.union([
  toolActionSchema,
  finalImplementationActionSchema,
]);

export type ImplementationPlan = z.infer<typeof implementationPlanSchema>;
export type ToolAction = z.infer<typeof toolActionSchema>;
export type FinalImplementationAction = z.infer<
  typeof finalImplementationActionSchema
>;
export type ImplementationAction = z.infer<typeof implementationActionSchema>;

export function parseImplementationPlan(source: string): ImplementationPlan {
  const result = implementationPlanSchema.safeParse(parseJsonObject(source));
  if (!result.success) {
    throw new Error(`Invalid implementation plan: ${result.error.message}`);
  }
  return result.data;
}

export function parseImplementationAction(
  source: string,
): ImplementationAction {
  const result = implementationActionSchema.safeParse(parseJsonObject(source));
  if (!result.success) {
    throw new Error(`Invalid implementation action: ${result.error.message}`);
  }
  return result.data;
}
