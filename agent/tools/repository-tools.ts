import type { AgentConfig } from "../config/schema.js";
import type { ProviderEnvironment } from "../types.js";
import type { ToolAction } from "../validation/implementation.js";
import { listDirectory } from "./listDirectory.js";
import { readFile } from "./readFile.js";
import { runCommand } from "./runCommand.js";
import { searchCode } from "./searchCode.js";
import type { ToolResult } from "./types.js";
import { writeFile } from "./writeFile.js";

export class RepositoryTools {
  constructor(
    private readonly root: string,
    private readonly config: AgentConfig,
    private readonly environment: ProviderEnvironment = process.env,
  ) {}

  async execute(action: ToolAction): Promise<ToolResult> {
    switch (action.tool) {
      case "read_file":
        return {
          ok: true,
          output: await readFile(this.root, action.input.path),
        };
      case "list_directory":
        return {
          ok: true,
          output: await listDirectory(this.root, action.input.path),
        };
      case "search_code":
        return {
          ok: true,
          output: await searchCode(
            this.root,
            action.input.query,
            action.input.path,
          ),
        };
      case "write_file":
        return {
          ok: true,
          output: await writeFile(
            this.root,
            action.input.path,
            action.input.content,
            this.config,
          ),
        };
      case "run_command": {
        const command = this.config.commands.find(
          (candidate) => candidate.name === action.input.name,
        );
        if (!command) {
          throw new Error(`Command is not allow-listed: ${action.input.name}`);
        }
        return runCommand(this.root, command, this.environment);
      }
    }
  }

  async runRequiredCommands(): Promise<readonly ToolResult[]> {
    const results: ToolResult[] = [];
    for (const command of this.config.commands.filter(
      (item) => item.required,
    )) {
      results.push(await runCommand(this.root, command, this.environment));
    }
    return results;
  }
}
