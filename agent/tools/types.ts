import type { AgentCommand } from "../config/schema.js";

export interface ToolResult {
  readonly ok: boolean;
  readonly output: string;
  readonly command?: AgentCommand;
  readonly exit_code?: number;
  readonly duration_ms?: number;
}
