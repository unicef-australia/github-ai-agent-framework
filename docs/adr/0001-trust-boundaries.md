# ADR 0001: Separate model execution from GitHub mutation

- Status: accepted
- Date: 2026-07-17

## Context

Issue bodies and repository files are untrusted model input. Giving the same
process model access and repository write credentials would make prompt
injection a credential-compromise path.

## Decision

Model-facing jobs receive read-only repository access and provider credentials
only. They emit schema-validated artifacts. Separate deterministic jobs receive
the minimum GitHub write permissions needed to apply labels, comment, or publish
a Draft PR.

The publisher never executes model output as shell and never merges.

## Consequences

Workflows have more jobs and explicit artifact contracts. That complexity is
intentional: it creates auditable, testable security boundaries.
