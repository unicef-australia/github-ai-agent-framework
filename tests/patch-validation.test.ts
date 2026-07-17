import { describe, expect, it } from "vitest";

import type { AgentConfig } from "../agent/config/schema.js";
import { validatePatch } from "../agent/validation/patch.js";

const config = {
  limits: {
    max_changed_files: 2,
    max_patch_lines: 20,
    allow_dependency_changes: false,
    allow_workflow_changes: false,
    protected_paths: [".github/workflows/", ".env", ".env.*", ".git"],
  },
} as AgentConfig;

describe("patch validation", () => {
  it("accepts a bounded source patch", () => {
    const patch = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1111111..2222222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "",
    ].join("\n");

    expect(validatePatch(patch, config).changed_files).toEqual(["src/a.ts"]);
  });

  it("rejects protected paths and binary patches", () => {
    const workflowPatch =
      "diff --git a/.github/workflows/pwn.yml b/.github/workflows/pwn.yml\n";
    expect(() => validatePatch(workflowPatch, config)).toThrow("protected");

    const binaryPatch =
      "diff --git a/image.png b/image.png\nGIT binary patch\nliteral 0\n";
    expect(() => validatePatch(binaryPatch, config)).toThrow("Binary patches");
  });
});
