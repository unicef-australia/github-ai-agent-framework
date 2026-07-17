import { spawn } from "node:child_process";

const MAX_GIT_OUTPUT_BYTES = 5_000_000;

interface GitResult {
  readonly code: number;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

export async function runGit(
  root: string,
  args: readonly string[],
  input?: string,
): Promise<GitResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, {
      cwd: root,
      shell: false,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    const collect =
      (target: Buffer[]) =>
      (chunk: Buffer): void => {
        bytes += chunk.byteLength;
        if (bytes > MAX_GIT_OUTPUT_BYTES) {
          child.kill("SIGKILL");
          return;
        }
        target.push(chunk);
      };
    child.stdout?.on("data", collect(stdout));
    child.stderr?.on("data", collect(stderr));
    child.on("error", reject);
    child.on("close", (code) => {
      if (bytes > MAX_GIT_OUTPUT_BYTES) {
        reject(new Error("Git output exceeded the 5 MB safety limit"));
        return;
      }
      resolvePromise({
        code: code ?? 1,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
      });
    });
    if (input !== undefined) {
      child.stdin?.end(input);
    }
  });
}

export async function requireCleanRepository(root: string): Promise<string> {
  const [status, sha] = await Promise.all([
    runGit(root, ["status", "--porcelain=v1"]),
    runGit(root, ["rev-parse", "HEAD"]),
  ]);
  if (status.code !== 0 || sha.code !== 0) {
    throw new Error(
      "Target directory must be a Git repository with a HEAD commit",
    );
  }
  if (status.stdout.length > 0) {
    throw new Error(
      "Implementation requires a clean target repository checkout",
    );
  }
  return sha.stdout.toString("utf8").trim();
}

export async function capturePatch(root: string): Promise<{
  readonly patch: string;
  readonly changedFiles: readonly string[];
}> {
  const intent = await runGit(root, ["add", "-N", "--", "."]);
  if (intent.code !== 0) {
    throw new Error(
      `Unable to inspect new files: ${intent.stderr.toString("utf8")}`,
    );
  }
  try {
    const [diff, names, check] = await Promise.all([
      runGit(root, [
        "diff",
        "--no-ext-diff",
        "--no-color",
        "--src-prefix=a/",
        "--dst-prefix=b/",
      ]),
      runGit(root, ["diff", "--name-only", "-z"]),
      runGit(root, ["diff", "--check"]),
    ]);
    if (diff.code !== 0 || names.code !== 0) {
      throw new Error(
        `Unable to capture implementation patch: ${diff.stderr.toString("utf8")}`,
      );
    }
    if (check.code !== 0) {
      throw new Error(
        `Patch whitespace validation failed:\n${check.stdout.toString("utf8")}`,
      );
    }
    return {
      patch: diff.stdout.toString("utf8"),
      changedFiles: names.stdout.toString("utf8").split("\0").filter(Boolean),
    };
  } finally {
    await runGit(root, ["reset", "--quiet"]);
  }
}
