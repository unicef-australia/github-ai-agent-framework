import { createHash } from "node:crypto";

import type { AgentConfig } from "../config/schema.js";
import { isDependencyPath, isProtectedPath } from "./paths.js";

export interface ValidatedPatch {
  readonly changed_files: readonly string[];
  readonly lines: number;
  readonly sha256: string;
}

export function validatePatch(
  patch: string,
  config: AgentConfig,
): ValidatedPatch {
  if (patch.includes("GIT binary patch") || patch.includes("Binary files ")) {
    throw new Error(
      "Binary patches are not supported by the trusted publisher",
    );
  }
  const files = [...patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)].map(
    (match) => {
      const before = match[1];
      const after = match[2];
      if (
        !before ||
        !after ||
        before.startsWith('"') ||
        after.startsWith('"')
      ) {
        throw new Error("Quoted or malformed patch paths are not supported");
      }
      return after;
    },
  );
  const changedFiles = [...new Set(files)];
  if (changedFiles.length === 0)
    throw new Error("Patch contains no changed files");
  if (changedFiles.length > config.limits.max_changed_files) {
    throw new Error(
      `Patch changes ${changedFiles.length} files; limit is ${config.limits.max_changed_files}`,
    );
  }
  const lines = patch.split("\n").length;
  if (lines > config.limits.max_patch_lines) {
    throw new Error(
      `Patch has ${lines} lines; limit is ${config.limits.max_patch_lines}`,
    );
  }
  for (const path of changedFiles) {
    if (isProtectedPath(path, config)) {
      throw new Error(`Patch modifies protected path: ${path}`);
    }
    if (!config.limits.allow_dependency_changes && isDependencyPath(path)) {
      throw new Error(`Patch modifies a dependency file: ${path}`);
    }
  }
  return {
    changed_files: changedFiles,
    lines,
    sha256: createHash("sha256").update(patch).digest("hex"),
  };
}
