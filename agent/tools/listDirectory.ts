import { readdir } from "node:fs/promises";

import { assertReadablePath } from "../validation/paths.js";

export async function listDirectory(
  root: string,
  path: string,
): Promise<string> {
  const absolute = await assertReadablePath(root, path);
  const entries = await readdir(absolute, { withFileTypes: true });
  return entries
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 500)
    .map((entry) => `${entry.isDirectory() ? "d" : "f"} ${entry.name}`)
    .join("\n");
}
