export function parseJsonObject(source: string): unknown {
  const trimmed = source.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const json = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(json) as unknown;
  } catch (error) {
    throw new Error("Model response was not a valid JSON object", {
      cause: error,
    });
  }
}
