import { z } from "zod";

const issueSchema = z.object({
  labels: z.array(
    z.union([z.string(), z.object({ name: z.string() }).passthrough()]),
  ),
});

const issueEventsSchema = z.array(
  z
    .object({
      event: z.string(),
      label: z.object({ name: z.string() }).passthrough().nullable().optional(),
      actor: z
        .object({ login: z.string(), type: z.string() })
        .passthrough()
        .nullable()
        .optional(),
    })
    .passthrough(),
);

async function githubJson(
  url: string,
  token: string,
  fetcher: typeof fetch,
): Promise<unknown> {
  const response = await fetcher(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `GitHub approval check failed (${response.status}): ${text.slice(0, 1_000)}`,
    );
  }
  return JSON.parse(text) as unknown;
}

export async function assertCurrentHumanApproval(options: {
  readonly repository: string;
  readonly issueNumber: number;
  readonly token: string;
  readonly fetcher?: typeof fetch;
}): Promise<{ readonly actor: string }> {
  if (!/^[^/]+\/[^/]+$/.test(options.repository)) {
    throw new Error("Repository must use owner/name form");
  }
  if (!Number.isSafeInteger(options.issueNumber) || options.issueNumber <= 0) {
    throw new Error("Issue number must be a positive integer");
  }
  if (!options.token)
    throw new Error("GITHUB_TOKEN is required for approval check");
  const fetcher = options.fetcher ?? fetch;
  const base = `https://api.github.com/repos/${options.repository}/issues/${options.issueNumber}`;
  const issue = issueSchema.parse(
    await githubJson(base, options.token, fetcher),
  );
  const labels = issue.labels.map((label) =>
    typeof label === "string" ? label : label.name,
  );
  if (!labels.includes("agent-approved")) {
    throw new Error("Issue no longer has agent-approved");
  }

  const approvalEvents: z.infer<typeof issueEventsSchema> = [];
  for (let page = 1; page <= 100; page += 1) {
    const events = issueEventsSchema.parse(
      await githubJson(
        `${base}/events?per_page=100&page=${page}`,
        options.token,
        fetcher,
      ),
    );
    approvalEvents.push(
      ...events.filter(
        (event) =>
          (event.event === "labeled" || event.event === "unlabeled") &&
          event.label?.name === "agent-approved",
      ),
    );
    if (events.length < 100) break;
    if (page === 100)
      throw new Error("Approval event history exceeded 10,000 events");
  }
  const latest = approvalEvents.at(-1);
  if (!latest || latest.event !== "labeled" || latest.actor?.type !== "User") {
    throw new Error("Latest agent-approved event was not applied by a human");
  }
  return { actor: latest.actor.login };
}
