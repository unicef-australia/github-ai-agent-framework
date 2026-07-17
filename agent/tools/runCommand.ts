import { spawn } from "node:child_process";
import { basename } from "node:path";

import type { AgentCommand } from "../config/schema.js";
import type { ProviderEnvironment } from "../types.js";
import type { ToolResult } from "./types.js";

const MAX_OUTPUT_BYTES = 200_000;
const forbiddenExecutables = new Set([
  "bash",
  "sh",
  "zsh",
  "fish",
  "cmd",
  "cmd.exe",
  "powershell",
  "pwsh",
  "env",
]);

function splitCommand(command: string): readonly string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = undefined;
      else current += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += character;
    }
  }
  if (escaped || quote) throw new Error(`Invalid quoted command: ${command}`);
  if (current) parts.push(current);
  if (parts.length === 0) throw new Error("Configured command is empty");
  return parts;
}

function sanitizedEnvironment(
  environment: ProviderEnvironment,
): Record<string, string> {
  const allowed = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "CI",
    "TERM",
    "SystemRoot",
    "RUNNER_TEMP",
    "RUNNER_TOOL_CACHE",
  ];
  const sanitized: Record<string, string> = {};
  for (const key of allowed) {
    const value = environment[key];
    if (value) sanitized[key] = value;
  }
  return sanitized;
}

export async function runCommand(
  root: string,
  command: AgentCommand,
  environment: ProviderEnvironment,
): Promise<ToolResult> {
  const [executable, ...args] = splitCommand(command.run);
  if (
    !executable ||
    forbiddenExecutables.has(basename(executable).toLowerCase())
  ) {
    throw new Error(
      `Shell executables are not allowed: ${executable ?? "unknown"}`,
    );
  }
  const startedAt = Date.now();
  return new Promise((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: root,
      env: sanitizedEnvironment(environment),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let truncated = false;
    const collect = (chunk: Buffer): void => {
      if (bytes >= MAX_OUTPUT_BYTES) {
        truncated = true;
        return;
      }
      const remaining = MAX_OUTPUT_BYTES - bytes;
      chunks.push(chunk.subarray(0, remaining));
      bytes += Math.min(chunk.byteLength, remaining);
      if (chunk.byteLength > remaining) truncated = true;
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
    }, command.timeout_minutes * 60_000);
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      const suffix = truncated ? "\n[output truncated]" : "";
      const timeoutMessage =
        signal === "SIGKILL" ? "\n[command timed out]" : "";
      resolvePromise({
        ok: code === 0,
        output: `${Buffer.concat(chunks).toString("utf8")}${suffix}${timeoutMessage}`,
        command,
        exit_code: code ?? 1,
        duration_ms: Date.now() - startedAt,
      });
    });
  });
}
