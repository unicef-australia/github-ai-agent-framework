import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { runTriage } from "../agent/core/triage.js";
import type { AIProvider, ChatRequest, ChatResponse } from "../agent/types.js";

class FixedProvider implements AIProvider {
  readonly name = "fixed";
  request: ChatRequest | undefined;

  chat(request: ChatRequest): Promise<ChatResponse> {
    this.request = request;
    return Promise.resolve({
      content: JSON.stringify({
        schema_version: 1,
        decision: "ready-for-agent",
        summary: "The issue has a bounded outcome.",
        reasoning: ["Acceptance criteria are explicit."],
        missing_information: [],
        implementation_outline: ["Add the requested public behaviour."],
      }),
    });
  }
}

describe("runTriage", () => {
  it("reads repository instructions and returns a trusted artifact", async () => {
    const root = await mkdtemp(join(tmpdir(), "triage-repo-"));
    await mkdir(join(root, ".github"));
    await writeFile(join(root, "AGENTS.md"), "Always run npm test.");
    await writeFile(join(root, "README.md"), "A sample repository.");
    await writeFile(
      join(root, ".github", "agent.yml"),
      `
triage: { provider: cloudflare, model: triage-model }
implementation: { provider: cloudflare, model: implementation-model }
review: { provider: cloudflare, model: review-model }
limits:
  max_changed_files: 8
  max_patch_lines: 1500
  allow_dependency_changes: false
  allow_workflow_changes: false
`,
    );
    const provider = new FixedProvider();

    const artifact = await runTriage({
      repositoryRoot: root,
      repository: "owner/repository",
      issue: {
        number: 42,
        title: "Add bounded capability",
        body: "Acceptance: the public command returns success.",
        labels: ["needs-agent-triage"],
        author: "octocat",
      },
      provider,
      now: () => new Date("2026-07-17T00:00:00.000Z"),
    });

    expect(provider.request?.messages.at(-1)?.content).toContain(
      "Always run npm test.",
    );
    expect(artifact.labels).toEqual({
      add: ["ready-for-agent"],
      remove: ["needs-agent-triage", "needs-discussion", "wontfix"],
    });
    expect(artifact.issue_number).toBe(42);
    expect(artifact.comment).toContain("A human must add `agent-approved`");
  });
});
