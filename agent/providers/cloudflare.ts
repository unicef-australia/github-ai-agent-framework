import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ProviderEnvironment,
} from "../types.js";
import {
  performOpenAICompatibleChat,
  requiredEnvironmentValue,
} from "./http.js";

export class CloudflareProvider implements AIProvider {
  readonly name = "cloudflare";

  constructor(
    private readonly environment: ProviderEnvironment = process.env,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const accountId = requiredEnvironmentValue(
      this.environment,
      "CLOUDFLARE_ACCOUNT_ID",
    );
    const token = requiredEnvironmentValue(
      this.environment,
      "CLOUDFLARE_API_TOKEN",
    );
    const headers = new Headers({
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    });
    const gatewayId = this.environment.CLOUDFLARE_AI_GATEWAY_ID;
    if (gatewayId) {
      headers.set("cf-aig-gateway-id", gatewayId);
    }

    return performOpenAICompatibleChat({
      providerName: this.name,
      url: `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`,
      headers,
      request,
      fetcher: this.fetcher,
    });
  }
}
