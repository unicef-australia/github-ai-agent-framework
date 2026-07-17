import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadAgentConfig } from "../agent/config/load.js";

async function repositoryWithConfig(source: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "agent-config-"));
  await mkdir(join(root, ".github"));
  await writeFile(join(root, ".github", "agent.yml"), source);
  return root;
}

describe("loadAgentConfig", () => {
  it("loads the documented provider defaults and secure limits", async () => {
    const root = await repositoryWithConfig(`
triage:
  provider: cloudflare
  model: "@cf/moonshotai/kimi-k2.7-code"
implementation:
  provider: cloudflare
  model: "moonshotai/kimi-k3"
review:
  provider: anthropic
  model: "claude-sonnet-4"
limits:
  max_changed_files: 8
  max_patch_lines: 1500
  allow_dependency_changes: false
  allow_workflow_changes: false
`);

    const config = await loadAgentConfig(root);

    expect(config.triage.model).toBe("@cf/moonshotai/kimi-k2.7-code");
    expect(config.limits.protected_paths).toContain(".github/workflows/");
    expect(config.implementation.max_steps).toBe(40);
    expect(config.commands).toEqual([]);
  });

  it("rejects unknown configuration keys", async () => {
    const root = await repositoryWithConfig(`
triage: { provider: cloudflare, model: model-a }
implementation: { provider: cloudflare, model: model-b }
review: { provider: cloudflare, model: model-c }
limits:
  max_changed_files: 8
  max_patch_lines: 1500
  allow_dependency_changes: false
  allow_workflow_changes: false
  arbitrary_shell: true
`);

    await expect(loadAgentConfig(root)).rejects.toThrow(
      "Invalid agent configuration",
    );
  });
});
