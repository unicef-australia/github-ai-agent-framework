import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { AgentConfig } from "../agent/config/schema.js";
import { validateImplementationBundle } from "../agent/core/publisher.js";

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

const config = {
  limits: {
    max_changed_files: 2,
    max_patch_lines: 100,
    allow_dependency_changes: false,
    allow_workflow_changes: false,
    protected_paths: [".github/workflows/", ".env", ".env.*", ".git"],
  },
  commands: [
    {
      name: "format",
      kind: "format",
      run: "npm run format:check",
      required: true,
      timeout_minutes: 10,
    },
    {
      name: "lint",
      kind: "lint",
      run: "npm run lint",
      required: true,
      timeout_minutes: 10,
    },
    {
      name: "test",
      kind: "test",
      run: "npm test",
      required: true,
      timeout_minutes: 10,
    },
  ],
} as AgentConfig;

function reportFor(patchSource: string): unknown {
  return {
    schema_version: 1,
    repository: "owner/repository",
    issue_number: 9,
    base_sha: "a".repeat(40),
    generated_at: "2026-07-17T00:00:00.000Z",
    provider: "cloudflare",
    model: "model",
    pr_title: "Update value",
    summary: "Updates the value.",
    approval: {
      label: "agent-approved",
      actor: "reviewer",
      actor_type: "User",
    },
    plan: {
      schema_version: 1,
      summary: "Update value.",
      steps: ["Update it"],
      files_to_inspect: ["src/a.ts"],
      tests: ["Test passes"],
    },
    changed_files: ["src/a.ts"],
    patch: {
      sha256: createHash("sha256").update(patchSource).digest("hex"),
      lines: patchSource.split("\n").length,
    },
    verification: {
      passed: true,
      commands: [
        {
          name: "format",
          kind: "format",
          run: "npm run format:check",
          exit_code: 0,
          duration_ms: 100,
          output: "passed",
        },
        {
          name: "lint",
          kind: "lint",
          run: "npm run lint",
          exit_code: 0,
          duration_ms: 100,
          output: "passed",
        },
        {
          name: "test",
          kind: "test",
          run: "npm test",
          exit_code: 0,
          duration_ms: 100,
          output: "passed",
        },
      ],
    },
    policy: {
      max_changed_files: 2,
      max_patch_lines: 100,
      allow_dependency_changes: false,
      allow_workflow_changes: false,
    },
    testing_notes: ["Tests passed"],
    risks: [],
  };
}

describe("trusted publisher bundle validation", () => {
  it("accepts a matching tested bundle", () => {
    const result = validateImplementationBundle(
      { patch, report: reportFor(patch), prBody: "## Summary\n\nSafe change." },
      config,
      { repository: "owner/repository", issue_number: 9 },
    );
    expect(result.report.base_sha).toBe("a".repeat(40));
  });

  it("rejects a patch changed after test reporting", () => {
    expect(() =>
      validateImplementationBundle(
        {
          patch: `${patch}\n# tampered`,
          report: reportFor(patch),
          prBody: "Safe change.",
        },
        config,
        { repository: "owner/repository", issue_number: 9 },
      ),
    ).toThrow("digest");
  });
});
