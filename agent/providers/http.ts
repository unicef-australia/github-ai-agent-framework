import { z } from "zod";

const MAX_RESPONSE_BYTES = 2_000_000;

export async function readProviderJson(
  response: Response,
  providerName: string,
): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error(`${providerName} response exceeded the 2 MB limit`);
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_RESPONSE_BYTES) {
    throw new Error(`${providerName} response exceeded the 2 MB limit`);
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
