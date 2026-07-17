import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function workflowSources(directory: string): Promise<readonly string[]> {
  const files = (await readdir(directory)).filter((name) =>
    name.endsWith(".yml"),
  );
  return Promise.all(
    files.map((name) => readFile(resolve(directory, name), "utf8")),
  );
}

describe("workflow security contracts", () => {
  it("pins every third-party Action to a commit SHA", async () => {
    const sources = await workflowSources(resolve(".github/workflows"));
    const references = sources.flatMap((source) =>
      [...source.matchAll(/uses:\s+actions\/[^@\s]+@([^\s#]+)/g)].map(
        (match) => match[1],
      ),
    );
    expect(references.length).toBeGreaterThan(0);
    expect(
      references.every((reference) => /^[0-9a-f]{40}$/.test(reference ?? "")),
    ).toBe(true);
  });

  it("installs immutable framework release references", async () => {
    const sources = await workflowSources(resolve("templates/workflows"));
    expect(sources.join("\n")).not.toContain("@main");
    expect(sources.join("\n")).toContain("@v0.1.0");
  });

  it("keeps implementation read-only and publication Draft-only", async () => {
    const implementation = await readFile(
      resolve(".github/workflows/implement.yml"),
      "utf8",
    );
    const publisher = await readFile(
      resolve(".github/workflows/publish.yml"),
      "utf8",
    );
    expect(implementation).not.toContain("contents: write");
    expect(implementation).not.toContain("pull-requests: write");
    expect(publisher).toContain("draft: true");
    expect(publisher).not.toContain("pulls.merge");
  });
});
