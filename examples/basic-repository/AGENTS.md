# Repository instructions

## Architecture

`src/greet.js` exports the public greeting function. Behavioural tests live in
`test/` and use Node's built-in test runner.

## Conventions

- Use ESM JavaScript.
- Keep `greet` deterministic and side-effect free.
- Reject invalid input with a `TypeError`.
- Add behavioural tests for every new public outcome.

## Commands

- Install: `npm ci`
- Format: `npm run format:check`
- Lint: `npm run lint`
- Test: `npm test`
- Build: `npm run build`

## Prohibited changes

- Do not add runtime dependencies.
- Do not change workflows, package metadata, or deployment configuration.

## Deployment

This example is not deployed. Pull requests are reviewed and merged manually.
