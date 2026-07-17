# Cloudflare-first roadmap

The Actions-first release keeps Cloudflare services optional and minimizes
free-tier usage. Inference is the only Cloudflare operation required by the
default installation.

## Target control plane

```text
GitHub App webhook
  -> Cloudflare Worker (signature verification and normalization)
  -> Queue (retryable event buffering)
  -> orchestrator
     -> Workers AI or another provider
     -> Workflows for durable human-gated sequences
  -> GitHub Actions implementation
  -> trusted publisher
```

## Extension points

- **Workers AI**: default hosted inference.
- **AI Gateway**: routing, observability, rate limits, caching, and cost policy.
- **Queues**: at-least-once webhook buffering and retry isolation.
- **Workflows**: durable multi-step execution and long human waits.
- **Durable Objects**: per-repository concurrency and state coordination.
- **D1**: normalized audit history and repository analytics.
- **R2**: longer-lived implementation bundles and reports.
- **Vectorize**: optional semantic repository/document retrieval.

## Adoption rule

Add a service only when a measured requirement needs it. Prefer request-local
state and GitHub-native artifacts first. Persistent writes, scheduled work, and
verbose logging must be justified against free-tier quotas and operational cost.
No future control-plane component may collapse the model/publisher credential
boundary or add automatic merge behaviour.
