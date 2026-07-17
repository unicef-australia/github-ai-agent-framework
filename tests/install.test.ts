import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { installFramework } from "../agent/install.js";

describe("installFramework", () => {
  it("installs pinned wrappers without overwriting repository instructions", async () => {
    const target = await mkdtemp(join(tmpdir(), "agent-install-"));
    await writeFile(join(target, "AGENTS.md"), "Keep my instructions.\n");

    const results = await installFramework({
      target,
      frameworkRef: "v1.2.3",
      templateRoot: resolve("templates"),
    });

    expect(results["AGENTS.md"]).toBe("skipped");
    expect(await readFile(join(target, "AGENTS.md"), "utf8")).toBe(
      "Keep my instructions.\n",
    );
    const workflow = await readFile(
      join(target, ".github", "workflows", "agent-triage.yml"),
      "utf8",
    );
    expect(workflow).toContain(
      "hwong103/github-ai-agent-framework/.github/workflows/triage.yml@v1.2.3",
    );
    expect(workflow).toContain("framework-ref: v1.2.3");
  });
});
