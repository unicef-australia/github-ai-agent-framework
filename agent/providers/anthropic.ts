import { z } from "zod";

import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ProviderEnvironment,
} from "../types.js";
import { readProviderJson, requiredEnvironmentValue } from "./http.js";

const anthropicResponseSchema = z.object({
  model: z.string().optional(),
  content: z
    .array(z.object({ type: z.string(), text: z.string().optional() }))
    .min(1),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative().optional(),
      output_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";

  constructor(
    private readonly environment: ProviderEnvironment = process.env,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const token = requiredEnvironmentValue(
      this.environment,
      "ANTHROPIC_API_KEY",
    );
    const system = request.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const messages = request.messages.filter(
      (message) => message.role !== "system",
    );
    const jsonInstruction =
      request.response_format === "json"
        ? "\n\nReturn one JSON object only, without Markdown fences."
        : "";
    const response = await this.fetcher(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": token,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.max_tokens ?? 8_192,
          temperature: request.temperature,
          system: `${system}${jsonInstruction}`,
          messages,
        }),
      },
    );
    const parsed = anthropicResponseSchema.parse(
      await readProviderJson(response, this.name),
    );
    const content = parsed.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");
    if (!content) {
      throw new Error("anthropic returned no text content");
    }
    return {
      content,
      ...(parsed.model ? { model: parsed.model } : {}),
      ...(parsed.usage?.input_tokens === undefined
        ? {}
        : { input_tokens: parsed.usage.input_tokens }),
      ...(parsed.usage?.output_tokens === undefined
        ? {}
        : { output_tokens: parsed.usage.output_tokens }),
    };
  }
}
