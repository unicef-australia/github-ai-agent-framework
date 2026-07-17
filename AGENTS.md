# Repository instructions

## Architecture

The framework is split into model-facing analysis, deterministic validation, and
credentialed publishing boundaries. Keep provider-specific behavior inside
`agent/providers/`. Keep GitHub write operations in trusted workflow steps.

Read `CONTEXT.md` and the ADRs in `docs/adr/` before changing architecture.

## Conventions

- TypeScript is strict ESM targeting Node.js 22 or later.
- Validate all untrusted JSON, YAML, model output, event payloads, and artifact
  files with Zod.
- Avoid `any`, double casts, shell execution, and module-level mutable state.
- Dependencies are injected at external boundaries so tests can use fakes.
- Tests exercise public seams rather than private implementation details.

## Commands

- Install: `npm ci`
- Format: `npm run format`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Test: `npm test`
- Full validation: `npm run check`

## Prohibited changes

- Never add automatic merge behavior.
- Never pass a GitHub write token into an AI or repository-command process.
- Never replace exact command allow-lists with arbitrary shell execution.
- Never weaken protected-path or patch-limit validation for convenience.

## Deployment

Tag stable releases and reference immutable tags or SHAs from installed
workflows. Deploying a Cloudflare Worker is not required for the initial GitHub
Actions implementation.
