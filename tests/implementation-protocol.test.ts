import { describe, expect, it } from "vitest";

import {
  parseImplementationAction,
  parseImplementationPlan,
} from "../agent/validation/implementation.js";

describe("implementation protocol", () => {
  it("parses a structured plan and one controlled tool request", () => {
    const plan = parseImplementationPlan(
      JSON.stringify({
        schema_version: 1,
        summary: "Add the public command.",
        steps: ["Read the command module", "Add behaviour", "Run tests"],
        files_to_inspect: ["src/command.ts"],
        tests: ["Command succeeds for the documented input"],
      }),
    );
    const action = parseImplementationAction(
      JSON.stringify({
        type: "tool",
        tool: "read_file",
        input: { path: "src/command.ts" },
      }),
    );

    expect(plan.steps).toHaveLength(3);
    expect(action.type).toBe("tool");
  });

  it("rejects raw commands and extra protocol fields", () => {
    expect(() =>
      parseImplementationAction(
        JSON.stringify({
          type: "tool",
          tool: "run_command",
          input: { command: "rm -rf ." },
        }),
      ),
    ).toThrow("Invalid implementation action");
  });
});
