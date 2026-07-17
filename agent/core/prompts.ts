import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const promptDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prompts",
);

export async function loadPrompt(name: string): Promise<string> {
  if (!/^[a-z][a-z0-9-]*\.md$/.test(name)) {
    throw new Error(`Invalid prompt name: ${name}`);
  }
  return readFile(resolve(promptDirectory, name), "utf8");
}
