import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { runImplementation } from "../agent/core/implementation.js";
import {
  validateBundleForPublish,
  verifyImplementationBundle,
} from "../agent/core/publisher.js";
import type { AIProvider, ChatResponse } from "../agent/types.js";

const execute = promisify(execFile);

class SequenceProvider implements AIProvider {
  readonly name = "fixed";
  private index = 0;

  constructor(private readonly responses: readonly string[]) {}

  chat(): Promise<ChatResponse> {
    const content = this.responses[this.index];
    this.index += 1;
    if (!content) return Promise.reject(new Error("Unexpected provider call"));
    return Promise.resolve({ content, model: "fixed-model" });
  }
}

async function git(root: string, ...args: string[]): Promise<string> {
  const result = await execute("git", args, { cwd: root });
  return result.stdout.trim();
}

describe("runImplementation", () => {
  it("produces a tested bundle without committing", async () => {
    const root = await mkdtemp(join(tmpdir(), "implementation-repo-"));
    const output = await mkdtemp(join(tmpdir(), "implementation-output-"));
    await mkdir(join(root, ".github"));
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "AGENTS.md"),
      "Run the configured test command.",
    );
    await writeFile(join(root, "src", "value.txt"), "old\n");
    await writeFile(join(root, "verify.mjs"), "process.exit(0)\n");
    await writeFile(
      join(root, ".github", "agent.yml"),
      `
triage: { provider: fixed, model: fixed-model }
implementation: { provider: fixed, model: fixed-model, max_steps: 5 }
review: { provider: fixed, model: fixed-model }
limits:
  max_changed_files: 2
  max_patch_lines: 100
  allow_dependency_changes: false
  allow_workflow_changes: false
commands:
  - name: test
    kind: test
    run: node verify.mjs
    required: true
`,
    );
    await git(root, "init", "-b", "main");
    await git(root, "config", "user.name", "Test");
    await git(root, "config", "user.email", "test@example.com");
    await git(root, "add", ".");
    await git(root, "commit", "-m", "initial");
    const originalSha = await git(root, "rev-parse", "HEAD");
    const provider = new SequenceProvider([
      JSON.stringify({
        schema_version: 1,
        summary: "Update the value.",
        steps: ["Update the value", "Run the test"],
        files_to_inspect: ["src/value.txt"],
        tests: ["Configured test passes"],
      }),
      JSON.stringify({
        type: "tool",
        tool: "write_file",
        input: { path: "src/value.txt", content: "new\n" },
      }),
      JSON.stringify({
        type: "final",
        summary: "Updated the value.",
        pr_title: "Update the value",
        pr_body: "## Summary\n\nUpdates the value.",
        testing_notes: ["Configured test passed"],
        risks: [],
      }),
    ]);

    const report = await runImplementation({
      repositoryRoot: root,
      outputDirectory: output,
      repository: "owner/repository",
      issue: {
        number: 7,
        title: "Update value",
        body: "Change old to new.",
        labels: ["agent-approved"],
        author: "octocat",
      },
      provider,
      now: () => new Date("2026-07-17T00:00:00.000Z"),
    });

    expect(report.verification.passed).toBe(true);
    expect(report.changed_files).toEqual(["src/value.txt"]);
    expect(
      await readFile(join(output, "implementation.patch"), "utf8"),
    ).toContain("+new");
    expect(await git(root, "rev-parse", "HEAD")).toBe(originalSha);

    const verifyRoot = await mkdtemp(join(tmpdir(), "publisher-verify-"));
    await execute("git", ["clone", "--quiet", root, verifyRoot]);
    const verificationPath = join(output, "publisher-verification.json");
    const verification = await verifyImplementationBundle({
      repositoryRoot: verifyRoot,
      bundleDirectory: output,
      outputPath: verificationPath,
      expected: { repository: "owner/repository", issue_number: 7 },
      now: () => new Date("2026-07-17T00:01:00.000Z"),
    });
    expect(verification.passed).toBe(true);

    const publishRoot = await mkdtemp(join(tmpdir(), "publisher-write-"));
    await execute("git", ["clone", "--quiet", root, publishRoot]);
    const metadata = await validateBundleForPublish({
      repositoryRoot: publishRoot,
      bundleDirectory: output,
      verificationPath,
      outputPath: join(output, "publish-metadata.json"),
      expected: { repository: "owner/repository", issue_number: 7 },
    });
    expect(metadata.branch).toMatch(/^agent\/issue-7-[0-9a-f]{12}$/);
  });
});
