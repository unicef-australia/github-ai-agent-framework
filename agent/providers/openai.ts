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

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  constructor(
    private readonly environment: ProviderEnvironment = process.env,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const token = requiredEnvironmentValue(this.environment, "OPENAI_API_KEY");
    const baseUrl = (
      this.environment.OPENAI_BASE_URL ?? "https://api.openai.com/v1"
    ).replace(/\/$/, "");
    return performOpenAICompatibleChat({
      providerName: this.name,
      url: `${baseUrl}/chat/completions`,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      request,
      fetcher: this.fetcher,
    });
  }
}
