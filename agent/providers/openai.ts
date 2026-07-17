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
    const response = await this.fetcher(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        max_completion_tokens: request.max_tokens,
        temperature: request.temperature,
        ...(request.response_format === "json"
          ? { response_format: { type: "json_object" } }
          : {}),
      }),
    });
    const parsed = chatCompletionSchema.parse(
      await readProviderJson(response, this.name),
    );
    const first = parsed.choices[0];
    if (!first) {
      throw new Error("openai returned no completion");
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
