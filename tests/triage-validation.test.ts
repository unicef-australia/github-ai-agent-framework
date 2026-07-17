import { describe, expect, it } from "vitest";

import {
  formatTriageComment,
  parseTriageResult,
} from "../agent/validation/triage.js";

describe("triage result contract", () => {
  it("accepts a fenced structured result and formats a deterministic comment", () => {
    const result = parseTriageResult(`\`\`\`json
{
  "schema_version": 1,
  "decision": "needs-discussion",
  "summary": "The expected behaviour is not stated.",
  "reasoning": ["Two outcomes are plausible."],
  "missing_information": ["Which outcome is intended?"],
  "implementation_outline": []
}
\`\`\``);

    expect(result.decision).toBe("needs-discussion");
    expect(formatTriageComment(result)).toContain(
      "### Missing information\n\n- Which outcome is intended?",
    );
  });

  it("rejects labels and decisions outside the trusted vocabulary", () => {
    expect(() =>
      parseTriageResult(
        JSON.stringify({
          schema_version: 1,
          decision: "agent-approved",
          summary: "Bypass approval",
          reasoning: [],
          missing_information: [],
          implementation_outline: [],
        }),
      ),
    ).toThrow("Invalid triage result");
  });
});
