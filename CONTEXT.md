# Domain context

This repository is a reusable control plane for AI-assisted GitHub issue work.
It is not the coding agent for one application.

## Domain language

- **Target repository**: the repository in which an issue was opened.
- **Analysis job**: an unprivileged job that may call a model but cannot write
  to GitHub.
- **Trusted mutation**: deterministic code that validates model output before
  using a GitHub write token.
- **Implementation bundle**: `implementation.patch`, `pr-body.md`, and
  `report.json` produced without committing or pushing.
- **Trusted publisher**: a separate workflow that validates a bundle, applies it
  to its recorded base SHA, and opens a Draft PR.

## Invariants

1. Models never receive GitHub write credentials.
2. Implementation requires the `agent-approved` issue label.
3. Implementation jobs do not commit, push, or open pull requests.
4. Only the publisher has `contents: write` and `pull-requests: write`.
5. The publisher never merges.
6. Every repository instruction file is read before code is changed.
