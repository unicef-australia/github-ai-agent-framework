import { describe, expect, it, vi } from "vitest";

import { assertCurrentHumanApproval } from "../agent/github/approval.js";

function fakeGitHub(actorType: string): typeof fetch {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({ labels: [{ name: "agent-approved" }] }),
    )
    .mockResolvedValueOnce(
      Response.json([
        {
          event: "labeled",
          label: { name: "agent-approved" },
          actor: { login: "reviewer", type: actorType },
        },
      ]),
    );
}

describe("current GitHub approval", () => {
  it("accepts the latest human-applied approval", async () => {
    const result = await assertCurrentHumanApproval({
      repository: "owner/repository",
      issueNumber: 1,
      token: "read-token",
      fetcher: fakeGitHub("User"),
    });
    expect(result.actor).toBe("reviewer");
  });

  it("rejects a label most recently applied by automation", async () => {
    await expect(
      assertCurrentHumanApproval({
        repository: "owner/repository",
        issueNumber: 1,
        token: "read-token",
        fetcher: fakeGitHub("Bot"),
      }),
    ).rejects.toThrow("not applied by a human");
  });
});
