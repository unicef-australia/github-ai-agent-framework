# Security policy and threat model

## Trust boundaries

Issue text, repository content, model responses, implementation artifacts, and
target test output are untrusted. Workflow code pinned from this framework,
repository configuration reviewed on the recorded base commit, GitHub Actions,
and deterministic validators form the trusted control plane.

## Credential isolation

- Model jobs do not receive GitHub write permissions.
- Checkout credentials are not persisted in model-facing jobs.
- Controlled target commands receive a minimal environment that omits provider
  keys, GitHub tokens, Actions runtime tokens, passwords, and credentials.
- The write-capable publisher never invokes a model or target command.
- Provider secrets are used only by the framework process to call the selected
  provider; they are never placed in prompts or tool results.

## Prompt injection

Prompts explicitly classify issue and repository text as untrusted data. More
importantly, prompt instructions are backed by deterministic controls: fixed
decision vocabularies, Zod schemas, path rules, exact commands, patch limits,
digest checks, and GitHub permission separation. Prompt wording is not treated
as a security boundary by itself.

## Patch publication

The publisher checks:

1. the requested repository and issue;
2. the current `agent-approved` label;
3. the recorded 40-character base SHA;
4. report and patch schemas;
5. patch/report digests and changed-file agreement;
6. current repository policy and protected paths;
7. successful required commands from implementation;
8. a fresh application and rerun of required commands in a read-only job;
9. that verification did not change the patch;
10. the same digests again immediately before publishing.

Only then can the publisher create a branch and Draft PR. It has no merge step.

## Residual risks

- A trusted repository command can execute repository code and use network
  access. It receives no framework credentials, but runner network isolation is
  outside this release's scope.
- A compromised pinned framework ref or GitHub Action dependency can compromise
  its workflow. Use immutable refs and review updates.
- GitHub-hosted runners and artifact infrastructure remain part of the trusted
  computing base.
- Model-generated code can still contain subtle defects. Required tests and a
  Draft PR reduce risk but do not replace human review.
- Enabling workflow or dependency changes increases review risk and should be
  rare.

## Reporting vulnerabilities

Open a private GitHub security advisory for the repository. Do not include live
tokens, private repository content, or exploitable target details in a public
issue.
