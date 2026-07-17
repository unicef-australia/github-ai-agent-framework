# GitHub AI Agent Framework

A reusable, provider-agnostic framework for triaging GitHub issues, producing
tested implementation patches, and publishing them as Draft Pull Requests.
Cloudflare is the default inference path; OpenAI and Anthropic are adapter
options. The framework never merges.

## What is implemented

| Phase        | Trigger                                      | Output                                              | GitHub write access             |
| ------------ | -------------------------------------------- | --------------------------------------------------- | ------------------------------- |
| 1. Triage    | Issue opened, reopened, or edited            | Validated decision, label, advisory comment         | Deterministic mutation job only |
| 2. Implement | Human adds `agent-approved`                  | `implementation.patch`, `pr-body.md`, `report.json` | None                            |
| 3. Publish   | Human manually selects an implementation run | Branch and Draft PR                                 | Trusted publisher only          |

The implementation and publisher workflows never merge a pull request.

## Architecture

```text
Issue event
  -> read-only triage model job
  -> strict JSON validation
  -> trusted label/comment job

agent-approved label
  -> read-only checkout
  -> structured plan
  -> controlled repository tools
  -> required format/lint/test/build commands
  -> tested implementation bundle

manual publish request
  -> read-only patch reapplication and test rerun
  -> digest and policy verification
  -> credentialed Git-only publisher
  -> Draft Pull Request
  -> human review and merge
```

The longer-term GitHub App → Worker → Queue architecture is compatible with the
core interfaces, but is deliberately not required by this release. Phase 1 needs
only GitHub Actions and one model provider.

## Install with a coding agent

Copy this prompt into Codex, Claude Code, or another coding agent while it is
working in the repository you want to configure:

```text
Install the GitHub AI Agent Framework into this repository using the immutable
v0.1.1 release from hwong103/github-ai-agent-framework.

1. Inspect this repository before changing anything. Read every applicable
   AGENTS.md, the project documentation, package scripts, and existing GitHub
   workflows.
2. Run:
   npx --yes github:hwong103/github-ai-agent-framework#v0.1.1 install \
     --target . --framework-ref v0.1.1
3. Do not use --force or overwrite existing files. If an installed file
   conflicts with an existing file, merge the required content carefully.
4. Customize .github/agent.yml for this repository. Configure the provider,
   models, context paths, limits, protected paths, and exact allow-listed
   format, lint, test, and build commands that this project actually supports.
5. Complete or merge AGENTS.md with the real architecture, conventions, test
   commands, prohibited changes, and deployment rules for this repository.
6. Preserve the security boundaries: human agent-approved label, read-only
   implementation permissions, protected workflow and environment files,
   Draft PRs only, and no automatic merging.
7. Never write provider tokens or GitHub credentials into the repository.
   Report the repository secrets that a human still needs to configure.
8. Validate the resulting YAML and run the repository's formatting, linting,
   tests, and build. Fix installation-related failures where safe.
9. Show the final diff and summarize installed files, validation results,
   required secrets, and remaining manual steps. Do not push unless asked.
```

## Quick start

From a target repository:

```bash
npx --yes github:hwong103/github-ai-agent-framework#v0.1.1 install \
  --target . \
  --framework-ref v0.1.1
```

`v0.1.1` is an immutable release tag; a full commit SHA is also supported. The
installer does not overwrite existing files unless `--force true` is supplied.

Then:

1. Complete `AGENTS.md` with the target repository's real architecture and
   rules.
2. Edit `.github/agent.yml`, especially the exact command allow-list.
3. Add provider secrets in the target repository.
4. Commit the three workflow wrappers, configuration, and instructions.
5. Open an issue to exercise triage.
6. Add `agent-approved` only after a human accepts the issue scope.
7. When implementation succeeds, manually run **Publish verified AI
   implementation** with the issue number and implementation workflow run ID.

See [the installation guide](docs/installation.md) for provider setup and the
complete adoption checklist.

## Providers

Every adapter implements the same interface:

```ts
interface AIProvider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}
```

Supported adapters:

- `cloudflare`: Cloudflare's OpenAI-compatible AI endpoint. Defaults use
  `@cf/moonshotai/kimi-k2.7-code` for triage/review and `moonshotai/kimi-k3` for
  implementation.
- `openai`: OpenAI Chat Completions, with optional `OPENAI_BASE_URL`.
- `anthropic`: Anthropic Messages.

Adding a provider requires one adapter and one registry entry; orchestration,
prompts, validation, and workflows do not change. See
[providers.md](docs/providers.md).

## Controlled implementation tools

The model can request only:

- `read_file`
- `list_directory`
- `search_code`
- `write_file`
- `run_command` by configured name

There is no arbitrary shell tool. Commands are exact configuration entries, are
launched with `shell: false`, and receive a minimal environment with model
provider and GitHub credentials removed. Required `format`, `lint`, and `test`
commands are mandatory.

## Repository contract

Every installed repository has:

- `.github/agent.yml`: providers, models, limits, context, and exact commands.
- `AGENTS.md`: architecture, conventions, test commands, prohibited changes, and
  deployment rules.
- Three small workflow wrappers calling this repository's reusable workflows.

The full configuration reference is in
[configuration.md](docs/configuration.md). A runnable target is available in
[examples/basic-repository](examples/basic-repository).

## Security properties

- Model-facing jobs have `contents: read` and, where needed, `issues: read`.
- GitHub write credentials are absent from model and target-command processes.
- Model JSON, event data, YAML, paths, patches, and reports are schema-checked.
- Workflow, environment, Git metadata, and configured protected paths are
  blocked by default.
- Dependency changes are blocked by default.
- The publisher checks the issue approval label, recorded base SHA, patch
  digest, report digest, changed paths, limits, and required test results.
- The write-capable publisher does not execute target repository code.
- PRs are always created with `draft: true`; no merge API exists in the
  framework.
- Framework release refs and third-party Actions are pinned; installed wrappers
  default to the immutable `v0.1.1` release.

Read [SECURITY.md](SECURITY.md) before enabling implementation in a sensitive
repository.

## Development

Requires Node.js 22 or later.

```bash
npm ci
npm run check
```

`npm run check` verifies formatting, linting, strict TypeScript, tests, and the
production build.

## Roadmap

The current interfaces leave room for a GitHub App webhook Worker, Queues,
Workflows, Durable Objects, D1 audit history, R2 artifacts, Vectorize context,
AI Gateway routing/cost controls, slash commands, PR review, security review,
multi-agent work, analytics, and a dashboard. None is required by the initial
installation. See [cloudflare-roadmap.md](docs/cloudflare-roadmap.md).

## License

MIT
