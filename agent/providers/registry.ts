import type { AIProvider, ProviderEnvironment } from "../types.js";
import { AnthropicProvider } from "./anthropic.js";
import { CloudflareProvider } from "./cloudflare.js";
import { OpenAIProvider } from "./openai.js";

export function createProvider(
  name: string,
  environment: ProviderEnvironment = process.env,
): AIProvider {
  switch (name) {
    case "cloudflare":
      return new CloudflareProvider(environment);
    case "openai":
      return new OpenAIProvider(environment);
    case "anthropic":
      return new AnthropicProvider(environment);
    default:
      throw new Error(
        `Unknown provider "${name}". Add an adapter and register it in agent/providers/registry.ts.`,
      );
  }
}
