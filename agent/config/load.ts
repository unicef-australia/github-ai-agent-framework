import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

import { agentConfigSchema, type AgentConfig } from "./schema.js";

export async function loadAgentConfig(
  repositoryRoot: string,
  configPath = ".github/agent.yml",
): Promise<AgentConfig> {
  const absolutePath = resolve(repositoryRoot, configPath);
  let source: string;
  try {
    source = await readFile(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`Unable to read agent configuration at ${absolutePath}`, {
      cause: error,
    });
  }

  let parsed: unknown;
  try {
    parsed = parse(source);
  } catch (error) {
    throw new Error(`Invalid YAML in agent configuration at ${absolutePath}`, {
      cause: error,
    });
  }

  const result = agentConfigSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid agent configuration: ${details}`);
  }
  return result.data;
}
