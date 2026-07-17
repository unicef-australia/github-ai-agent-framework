import { z } from "zod";

import type { ChatRequest, ChatResponse } from "../types.js";

const MAX_RESPONSE_BYTES = 2_000_000;

export async function readProviderJson(
  response: Response,
  providerName: string,
): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error(`${providerName} response exceeded the 2 MB limit`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`${providerName} returned an empty response`);
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error(`${providerName} response exceeded the 2 MB limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(body);
  if (!response.ok) {
    throw new Error(
      `${providerName} request failed (${response.status}): ${text.slice(0, 1_000)}`,
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`${providerName} returned invalid JSON`, { cause: error });
  }
}

export const chatCompletionSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string() }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export async function performOpenAICompatibleChat(options: {
  readonly providerName: string;
  readonly url: string;
  readonly headers: HeadersInit;
  readonly request: ChatRequest;
  readonly fetcher: typeof fetch;
}): Promise<ChatResponse> {
  const response = await options.fetcher(options.url, {
    method: "POST",
    headers: options.headers,
    body: JSON.stringify({
      model: options.request.model,
      messages: options.request.messages,
      max_completion_tokens: options.request.max_tokens,
      temperature: options.request.temperature,
      ...(options.request.response_format === "json"
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });
  const parsed = chatCompletionSchema.parse(
    await readProviderJson(response, options.providerName),
  );
  const first = parsed.choices[0];
  if (!first) {
    throw new Error(`${options.providerName} returned no completion`);
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

export function requiredEnvironmentValue(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = environment[key];
  if (!value) {
    throw new Error(`${key} is required for this provider`);
  }
  return value;
}
