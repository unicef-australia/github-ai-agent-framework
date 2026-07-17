import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { AgentConfig } from "../agent/config/schema.js";
import { RepositoryTools } from "../agent/tools/repository-tools.js";
import { assertWritablePath } from "../agent/validation/paths.js";

const config: AgentConfig = {
  version: 1,
  triage: {
    provider: "fixed",
    model: "model",
    max_tokens: 100,
    temperature: 0,
  },
  implementation: {
    provider: "fixed",
    model: "model",
    max_tokens: 100,
    temperature: 0,
    max_steps: 10,
  },
  review: {
    provider: "fixed",
    model: "model",
    max_tokens: 100,
    temperature: 0,
  },
  limits: {
    max_changed_files: 8,
    max_patch_lines: 1500,
    allow_dependency_changes: false,
    allow_workflow_changes: false,
    protected_paths: [
      ".github/workflows/",
      "AGENTS.md",
      "*/AGENTS.md",
      ".env",
      ".env.*",
      ".git",
    ],
  },
  commands: [
    {
      name: "inspect-env",
      kind: "test",
      run: "node inspect-env.mjs",
      required: true,
      timeout_minutes: 1,
    },
  ],
  context: { include: ["AGENTS.md"], max_bytes: 250_000 },
};

describe("controlled repository tools", () => {
  it("refuses protected, dependency, and escaping writes", async () => {
    const root = await mkdtemp(join(tmpdir(), "tool-policy-"));
    await mkdir(join(root, ".github", "workflows"), { recursive: true });

    await expect(
      assertWritablePath(root, "src/index.ts", config),
    ).resolves.toBe(join(root, "src/index.ts"));
    await expect(
      assertWritablePath(root, ".github/workflows/release.yml", config),
    ).rejects.toThrow("protected");
    await expect(
      assertWritablePath(root, ".env.local", config),
    ).rejects.toThrow("protected");
    await expect(
      assertWritablePath(root, "src/AGENTS.md", config),
    ).rejects.toThrow("protected");
    await expect(
      assertWritablePath(root, "package.json", config),
    ).rejects.toThrow("Dependency changes");
    await expect(
      assertWritablePath(root, "../outside.txt", config),
    ).rejects.toThrow("outside");
  });

  it("runs only a named command with provider secrets removed", async () => {
    const root = await mkdtemp(join(tmpdir(), "tool-command-"));
    await writeFile(
      join(root, "inspect-env.mjs"),
      "console.log(process.env.OPENAI_API_KEY ?? 'clean')",
    );
    const tools = new RepositoryTools(root, config, {
      ...process.env,
      OPENAI_API_KEY: "must-not-reach-command",
    });

    const result = await tools.execute({
      type: "tool",
      tool: "run_command",
      input: { name: "inspect-env" },
    });

    expect(result.ok).toBe(true);
    expect(result.output).toContain("clean");
    expect(result.output).not.toContain("must-not-reach-command");
    await expect(
      tools.execute({
        type: "tool",
        tool: "run_command",
        input: { name: "node -e arbitrary" },
      }),
    ).rejects.toThrow("not allow-listed");
  });

  it("rejects absolute and env-indirected shell executables", async () => {
    const root = await mkdtemp(join(tmpdir(), "tool-shell-"));
    for (const [name, run] of [
      ["absolute-shell", "/bin/sh -c true"],
      ["env-shell", "env sh -c true"],
    ] as const) {
      const tools = new RepositoryTools(root, {
        ...config,
        commands: [
          {
            name,
            kind: "test",
            run,
            required: true,
            timeout_minutes: 1,
          },
        ],
      });
      await expect(
        tools.execute({
          type: "tool",
          tool: "run_command",
          input: { name },
        }),
      ).rejects.toThrow("Shell executables are not allowed");
    }
  });
});
