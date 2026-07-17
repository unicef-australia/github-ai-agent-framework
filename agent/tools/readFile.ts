import { readFile as readFileFromDisk } from "node:fs/promises";

import { assertReadablePath } from "../validation/paths.js";

const MAX_READ_BYTES = 100_000;

export async function readFile(root: string, path: string): Promise<string> {
  const absolute = await assertReadablePath(root, path);
  const buffer = await readFileFromDisk(absolute);
  if (buffer.byteLength > MAX_READ_BYTES) {
    return `${buffer.subarray(0, MAX_READ_BYTES).toString("utf8")}\n[truncated at ${MAX_READ_BYTES} bytes]`;
  }
  return buffer.toString("utf8");
}
