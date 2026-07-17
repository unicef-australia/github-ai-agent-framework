import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import type { AgentConfig } from "../config/schema.js";

const ignoredDirectories = new Set([
  ".git",
  "node_modules",
  "dist",
  "coverage",
  "artifacts",
]);

export interface ContextFile {
  readonly path: string;
  readonly content: string;
}

function isInside(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

async function collectPath(
  root: string,
  path: string,
  files: string[],
): Promise<void> {
  const absolute = resolve(root, path);
  if (!isInside(root, absolute)) return;

  let stats;
  try {
    stats = await lstat(absolute);
  } catch {
    return;
  }
  if (stats.isSymbolicLink()) return;
  if (stats.isFile()) {
    files.push(absolute);
    return;
  }
  if (
    !stats.isDirectory() ||
    ignoredDirectories.has(path.split(/[\\/]/).at(-1) ?? "")
  ) {
    return;
  }
  const entries = await readdir(absolute, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink() || ignoredDirectories.has(entry.name)) continue;
    await collectPath(
      root,
      relative(root, resolve(absolute, entry.name)),
      files,
    );
  }
}

export async function collectRepositoryContext(
  repositoryRoot: string,
  config: AgentConfig,
): Promise<readonly ContextFile[]> {
  const root = await realpath(repositoryRoot);
  const candidates: string[] = [];
  for (const includedPath of config.context.include) {
    await collectPath(root, includedPath, candidates);
  }

  const unique = [...new Set(candidates)].sort();
  const files: ContextFile[] = [];
  let totalBytes = 0;
  for (const absolute of unique) {
    const details = await stat(absolute);
    if (totalBytes + details.size > config.context.max_bytes) continue;
    const content = await readFile(absolute, "utf8");
    const byteLength = Buffer.byteLength(content);
    if (totalBytes + byteLength > config.context.max_bytes) break;
    files.push({ path: relative(root, absolute), content });
    totalBytes += byteLength;
  }
  return files;
}

export async function collectRepositoryInstructions(
  repositoryRoot: string,
  maxBytes: number,
): Promise<readonly ContextFile[]> {
  const root = await realpath(repositoryRoot);
  const paths: string[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (entry.isSymbolicLink() || ignoredDirectories.has(entry.name))
        continue;
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile() && entry.name === "AGENTS.md") {
        paths.push(absolute);
      }
    }
  }

  await visit(root);
  const instructions: ContextFile[] = [];
  let totalBytes = 0;
  for (const absolute of paths.sort()) {
    const details = await stat(absolute);
    if (totalBytes + details.size > maxBytes) {
      throw new Error(
        "Repository instruction files exceed the context byte limit",
      );
    }
    const content = await readFile(absolute, "utf8");
    instructions.push({ path: relative(root, absolute), content });
    totalBytes += details.size;
  }
  return instructions;
}

export function formatRepositoryContext(files: readonly ContextFile[]): string {
  return files
    .map(
      (file) =>
        `\n--- BEGIN ${file.path} ---\n${file.content}\n--- END ${file.path} ---`,
    )
    .join("\n");
}
