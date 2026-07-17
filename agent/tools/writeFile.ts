import { mkdir, writeFile as writeFileToDisk } from "node:fs/promises";
import { dirname } from "node:path";

import type { AgentConfig } from "../config/schema.js";
import { assertWritablePath } from "../validation/paths.js";

export async function writeFile(
  root: string,
  path: string,
  content: string,
  config: AgentConfig,
): Promise<string> {
  const absolute = await assertWritablePath(root, path, config);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFileToDisk(absolute, content, "utf8");
  return `Wrote ${Buffer.byteLength(content)} bytes to ${path}`;
}
