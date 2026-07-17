# ADR 0002: Start with Actions and keep the Cloudflare control plane optional

- Status: accepted
- Date: 2026-07-17

## Context

The long-term architecture uses a GitHub App webhook, Worker, Queue, and agent
orchestrator. Requiring those services in the first release would increase
installation cost and operational surface before issue triage is proven.

## Decision

The initial release uses reusable GitHub Actions and Cloudflare Workers AI over
its API. Provider adapters and orchestration contracts do not depend on GitHub
Actions, so a Worker/Queue transport can be added without changing prompts,
validation, or provider selection.

## Consequences

Phase 1 needs only GitHub Actions plus one configured model provider. Queues,
D1, Durable Objects, Workflows, Vectorize, R2, and AI Gateway features remain
optional extensions.
