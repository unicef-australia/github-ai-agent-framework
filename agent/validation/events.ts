import { z } from "zod";

const eventLabelSchema = z.union([
  z.string(),
  z.object({ name: z.string() }).passthrough(),
]);

export const githubIssueEventSchema = z
  .object({
    action: z.string().optional(),
    label: z.object({ name: z.string() }).passthrough().optional(),
    sender: z
      .object({ login: z.string(), type: z.string() })
      .passthrough()
      .optional(),
    repository: z.object({ full_name: z.string() }).passthrough().optional(),
    issue: z
      .object({
        number: z.number().int().positive(),
        title: z.string(),
        body: z.string().nullable(),
        labels: z.array(eventLabelSchema),
        user: z.object({ login: z.string() }).passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

export interface IssueContext {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
  readonly author: string;
}

export interface HumanApproval {
  readonly label: "agent-approved";
  readonly actor: string;
  readonly actor_type: "User";
}

export function humanApprovalFromEvent(event: unknown): HumanApproval {
  const parsed = githubIssueEventSchema.parse(event);
  if (
    parsed.action !== "labeled" ||
    parsed.label?.name !== "agent-approved" ||
    parsed.sender?.type !== "User"
  ) {
    throw new Error(
      "Implementation must be triggered by a human applying agent-approved",
    );
  }
  return {
    label: "agent-approved",
    actor: parsed.sender.login,
    actor_type: "User",
  };
}

export function issueContextFromEvent(event: unknown): {
  readonly repository?: string;
  readonly issue: IssueContext;
} {
  const parsed = githubIssueEventSchema.parse(event);
  const issue = {
    number: parsed.issue.number,
    title: parsed.issue.title,
    body: parsed.issue.body ?? "",
    labels: parsed.issue.labels.map((label) =>
      typeof label === "string" ? label : label.name,
    ),
    author: parsed.issue.user.login,
  };
  return {
    ...(parsed.repository ? { repository: parsed.repository.full_name } : {}),
    issue,
  };
}
