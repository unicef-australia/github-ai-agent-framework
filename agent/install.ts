import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface InstallOptions {
  readonly target: string;
  readonly frameworkRef: string;
  readonly force?: boolean;
  readonly templateRoot?: string;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function defaultTemplateRoot(): Promise<string> {
  const current = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(current, "..", "..", "templates"),
    resolve(current, "..", "templates"),
  ];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error("Unable to locate framework templates");
}

async function copyTemplate(
  source: string,
  destination: string,
  replacements: Readonly<Record<string, string>>,
  force: boolean,
): Promise<"created" | "replaced" | "skipped"> {
  const destinationExists = await exists(destination);
  if (destinationExists && !force) return "skipped";
  let content = await readFile(source, "utf8");
  for (const [from, to] of Object.entries(replacements)) {
    content = content.replaceAll(from, to);
  }
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, { encoding: "utf8", mode: 0o644 });
  return destinationExists ? "replaced" : "created";
}

export async function installFramework(
  options: InstallOptions,
): Promise<Readonly<Record<string, "created" | "replaced" | "skipped">>> {
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(options.frameworkRef)) {
    throw new Error(
      "Framework ref must be a tag, branch, or commit-like value",
    );
  }
  const target = resolve(options.target);
  const templates = options.templateRoot ?? (await defaultTemplateRoot());
  const replacements = {
    "@v0.1.1": `@${options.frameworkRef}`,
    "framework-ref: v0.1.1": `framework-ref: ${options.frameworkRef}`,
  };
  const files: ReadonlyArray<readonly [string, string]> = [
    ["workflows/triage.yml", ".github/workflows/agent-triage.yml"],
    ["workflows/implement.yml", ".github/workflows/agent-implement.yml"],
    ["workflows/publish.yml", ".github/workflows/agent-publish.yml"],
    ["agent.yml", ".github/agent.yml"],
    ["AGENTS.md", "AGENTS.md"],
  ];
  const results: Record<string, "created" | "replaced" | "skipped"> = {};
  for (const [source, destination] of files) {
    results[destination] = await copyTemplate(
      resolve(templates, source),
      resolve(target, destination),
      replacements,
      options.force ?? false,
    );
  }
  return results;
}
