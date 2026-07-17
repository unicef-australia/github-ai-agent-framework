import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ProviderEnvironment,
} from "../types.js";
import {
  chatCompletionSchema,
  readProviderJson,
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

    const response = await this.fetcher(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          max_completion_tokens: request.max_tokens,
          temperature: request.temperature,
          ...(request.response_format === "json"
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      },
    );
    const parsed = chatCompletionSchema.parse(
      await readProviderJson(response, this.name),
    );
    const first = parsed.choices[0];
    if (!first) {
      throw new Error("cloudflare returned no completion");
    }
    return {
      content: first.message.content,
      ...(parsed.model ? { model: parsed.model } : {}),
      ...(parsed.usage?.prompt_tokens === undefined
        ? {}
        : { input_tokens: parsed.usage.prompt_tokens }),
      ...(parsed.usage?.completion_tokens === undefined
        ? {}
        : { output_tokens: parsed.usage.completion_tokens }),
    };
  }
}
