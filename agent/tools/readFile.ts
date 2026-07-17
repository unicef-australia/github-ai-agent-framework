import { open } from "node:fs/promises";

import { assertReadablePath } from "../validation/paths.js";

const MAX_READ_BYTES = 100_000;

export async function readFile(root: string, path: string): Promise<string> {
  const absolute = await assertReadablePath(root, path);
  const handle = await open(absolute, "r");
  try {
    const buffer = Buffer.alloc(MAX_READ_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > MAX_READ_BYTES) {
      return `${buffer.subarray(0, MAX_READ_BYTES).toString("utf8")}\n[truncated at ${MAX_READ_BYTES} bytes]`;
    }
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}
