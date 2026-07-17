import { lstat, readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { assertReadablePath } from "../validation/paths.js";

const ignored = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "artifacts",
]);
const MAX_RESULTS = 200;
const MAX_OUTPUT_BYTES = 80_000;

export async function searchCode(
  root: string,
  query: string,
  path: string,
): Promise<string> {
  const start = await assertReadablePath(root, path);
  const results: string[] = [];

  async function visit(absolute: string): Promise<void> {
    if (results.length >= MAX_RESULTS) return;
    const entries = await readdir(absolute, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (results.length >= MAX_RESULTS) return;
      if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
      const child = resolve(absolute, entry.name);
      if (entry.isDirectory()) {
        await visit(child);
        continue;
      }
      if (!entry.isFile()) continue;
      let content: string;
      try {
        const details = await stat(child);
        if (details.size > 1_000_000) continue;
        const buffer = await readFile(child);
        if (buffer.includes(0)) continue;
        content = buffer.toString("utf8");
      } catch {
        continue;
      }
      for (const [index, line] of content.split("\n").entries()) {
        if (line.includes(query)) {
          results.push(`${relative(root, child)}:${index + 1}:${line}`);
          if (results.length >= MAX_RESULTS) break;
        }
      }
    }
  }

  const stats = await lstat(start);
  if (stats.isDirectory()) {
    await visit(start);
  } else {
    if (stats.size > 1_000_000) return "File exceeds the 1 MB search limit";
    const content = await readFile(start, "utf8");
    for (const [index, line] of content.split("\n").entries()) {
      if (line.includes(query))
        results.push(`${relative(root, start)}:${index + 1}:${line}`);
    }
  }
  const output = results.join("\n");
  return Buffer.byteLength(output) > MAX_OUTPUT_BYTES
    ? `${Buffer.from(output).subarray(0, MAX_OUTPUT_BYTES).toString("utf8")}\n[truncated]`
    : output || "No matches";
}
