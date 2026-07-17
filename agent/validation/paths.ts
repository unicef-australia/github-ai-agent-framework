import { lstat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { AgentConfig } from "../config/schema.js";

const dependencyFiles = new Set([
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
  "pyproject.toml",
  "poetry.lock",
  "requirements.txt",
  "Pipfile",
  "Pipfile.lock",
  "go.mod",
  "go.sum",
  "Cargo.toml",
  "Cargo.lock",
  "Gemfile",
  "Gemfile.lock",
]);

function normalizeRepositoryPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function globMatches(path: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(path);
}

export function isProtectedPath(path: string, config: AgentConfig): boolean {
  const normalized = normalizeRepositoryPath(path);
  return config.limits.protected_paths.some((rule) => {
    const normalizedRule = normalizeRepositoryPath(rule);
    if (
      normalizedRule === ".github/workflows/" &&
      config.limits.allow_workflow_changes
    ) {
      return false;
    }
    if (normalizedRule.includes("*"))
      return globMatches(normalized, normalizedRule);
    if (normalizedRule.endsWith("/"))
      return normalized.startsWith(normalizedRule);
    return (
      normalized === normalizedRule ||
      normalized.startsWith(`${normalizedRule}/`)
    );
  });
}

export function isDependencyPath(path: string): boolean {
  const normalized = normalizeRepositoryPath(path);
  const name = normalized.split("/").at(-1) ?? normalized;
  return dependencyFiles.has(name);
}

function assertRelativeInside(root: string, path: string): string {
  if (path.includes("\0") || isAbsolute(path)) {
    throw new Error(`Path is outside the repository: ${path}`);
  }
  const absolute = resolve(root, path);
  const rel = relative(resolve(root), absolute);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Path is outside the repository: ${path}`);
  }
  return absolute;
}

async function assertNoSymlinkAncestor(
  root: string,
  absolute: string,
): Promise<void> {
  const rel = relative(resolve(root), absolute);
  let current = resolve(root);
  for (const segment of rel.split(sep)) {
    current = resolve(current, segment);
    try {
      const stats = await lstat(current);
      if (stats.isSymbolicLink()) {
        throw new Error(`Path traverses a symbolic link: ${rel}`);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Path traverses")
      ) {
        throw error;
      }
      return;
    }
  }
}

export async function assertReadablePath(
  root: string,
  path: string,
): Promise<string> {
  const absolute = assertRelativeInside(root, path);
  await assertNoSymlinkAncestor(root, absolute);
  return absolute;
}

export async function assertWritablePath(
  root: string,
  path: string,
  config: AgentConfig,
): Promise<string> {
  const absolute = assertRelativeInside(root, path);
  const normalized = normalizeRepositoryPath(relative(resolve(root), absolute));
  if (isProtectedPath(normalized, config)) {
    throw new Error(`Refusing to modify protected path: ${normalized}`);
  }
  if (!config.limits.allow_dependency_changes && isDependencyPath(normalized)) {
    throw new Error(`Dependency changes are disabled: ${normalized}`);
  }
  await assertNoSymlinkAncestor(root, absolute);
  return absolute;
}
