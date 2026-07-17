# Installation guide

## Prerequisites

- A target GitHub repository with Actions enabled.
- Node.js 22 or later for local installation.
- One supported model provider account.
- Permission to add repository Actions secrets and workflow files.

## 1. Install the repository files

Run this in the target repository:

```bash
npx --yes github:hwong103/github-ai-agent-framework install \
  --target . \
  --framework-ref main
```

Use a release tag or full commit SHA instead of `main` for a stable production
installation. The command creates:

```text
.github/agent.yml
.github/workflows/agent-triage.yml
.github/workflows/agent-implement.yml
.github/workflows/agent-publish.yml
AGENTS.md                       # only when absent
```

Existing files are preserved. `--force true` deliberately replaces them.

## 2. Write repository instructions

Replace the starter `AGENTS.md`. It must document:

- architecture and module boundaries;
- coding and dependency conventions;
- exact formatting, linting, test, and build commands;
- prohibited changes;
- deployment and release rules.

Implementation fails closed when `AGENTS.md` is absent.

## 3. Configure commands and limits

Edit `.github/agent.yml`. Commands are not shell fragments selected by the
model. Each entry is a trusted, exact command selected by name and launched
without a shell. At least one required `kind: test` command is mandatory.

Start with dependency and workflow changes disabled. Increase patch limits only
after reviewing real workloads.

## 4. Configure a provider

### Cloudflare (default)

Create a Workers AI API token and store:

```bash
gh secret set CLOUDFLARE_ACCOUNT_ID
gh secret set CLOUDFLARE_API_TOKEN
```

If routing through a named AI Gateway, also set:

```bash
gh secret set CLOUDFLARE_AI_GATEWAY_ID
```

The default triage model is Workers AI-hosted Kimi K2.7 Code. The default
implementation model, Kimi K3, is addressed through Cloudflare's unified AI
endpoint. No Queue, D1, R2, Durable Object, Vectorize, or scheduled Worker is
required.

### OpenAI

Set `provider: openai`, choose a model, then:

```bash
gh secret set OPENAI_API_KEY
```

### Anthropic

Set `provider: anthropic`, choose a model, then:

```bash
gh secret set ANTHROPIC_API_KEY
```

## 5. Commit the installation

Review the exact workflow permissions before committing. The expected split is:

- triage analysis: `contents: read`, `issues: read`;
- triage mutation: `issues: write`;
- implementation: `contents: read`, `issues: read`;
- publisher verification: read permissions;
- publisher mutation: `contents: write`, `pull-requests: write`.

## 6. Operate the workflow

1. Open an issue. Triage assigns `needs-discussion`, `ready-for-agent`, or
   `wontfix` and upserts one advisory comment.
2. A human reviews the issue and adds `agent-approved`.
3. The implementation workflow uploads a bundle. It never commits or pushes.
4. A human inspects the run and notes its numeric run ID.
5. Manually dispatch **Publish verified AI implementation**, entering the issue
   number and run ID.
6. Review the resulting Draft PR. Merge remains a human action outside the
   framework.

## Updating

Re-run the installer with a newer immutable ref. Without `--force true`, it
reports existing files as skipped so local configuration is never silently
discarded. Compare wrapper changes manually before replacing them.
