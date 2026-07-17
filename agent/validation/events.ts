import { z } from "zod";

const eventLabelSchema = z.union([
  z.string(),
  z.object({ name: z.string() }).passthrough(),
]);

export const githubIssueEventSchema = z
  .object({
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
