# Provider adapters

Provider selection is configuration, not workflow logic. Adapters translate the
common `ChatRequest` and normalize a `ChatResponse`.

## Cloudflare

Environment variables:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_AI_GATEWAY_ID` (optional)

The adapter calls Cloudflare's OpenAI-compatible `/ai/v1/chat/completions`
endpoint. This supports Workers AI identifiers such as
`@cf/moonshotai/kimi-k2.7-code` and unified catalog identifiers such as
`moonshotai/kimi-k3`.

Official references:

- [Workers AI REST API](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- [OpenAI-compatible endpoint](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)
- [Workers AI model catalog](https://developers.cloudflare.com/workers-ai/models/)
- [Cloudflare unified AI REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)

## OpenAI

Environment variables:

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` (optional; defaults to `https://api.openai.com/v1`)

## Anthropic

Environment variable: `ANTHROPIC_API_KEY`.

## Adding another provider

1. Implement `AIProvider` in `agent/providers/<name>.ts`.
2. Validate the provider's untrusted HTTP response.
3. Register the adapter in `agent/providers/registry.ts`.
4. Add contract tests using a fake HTTP boundary.
5. Document credentials without placing them in configuration files.
