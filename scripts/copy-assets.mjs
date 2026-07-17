import { cp, mkdir } from "node:fs/promises";

await mkdir("dist/agent", { recursive: true });
await cp("agent/prompts", "dist/agent/prompts", { recursive: true });
