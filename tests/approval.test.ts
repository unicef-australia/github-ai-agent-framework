import { describe, expect, it } from "vitest";

import { humanApprovalFromEvent } from "../agent/validation/events.js";

function event(senderType: string): unknown {
  return {
    action: "labeled",
    label: { name: "agent-approved" },
    sender: { login: "reviewer", type: senderType },
    issue: {
      number: 1,
      title: "Approved issue",
      body: "Implement it",
      labels: [{ name: "agent-approved" }],
      user: { login: "author" },
    },
  };
}

describe("human approval event", () => {
  it("accepts a human-applied approval label", () => {
    expect(humanApprovalFromEvent(event("User")).actor).toBe("reviewer");
  });

  it("rejects approval applied by automation", () => {
    expect(() => humanApprovalFromEvent(event("Bot"))).toThrow(
      "human applying agent-approved",
    );
  });
});
