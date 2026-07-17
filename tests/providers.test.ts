import { describe, expect, it, vi } from "vitest";

import { CloudflareProvider } from "../agent/providers/cloudflare.js";
import { createProvider } from "../agent/providers/registry.js";

describe("AI providers", () => {
  it("calls the Cloudflare OpenAI-compatible endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"decision":"ready-for-agent"}' } }],
      }),
    );
    const provider = new CloudflareProvider(
      {
        CLOUDFLARE_ACCOUNT_ID: "account-id",
        CLOUDFLARE_API_TOKEN: "secret-token",
      },
      fetcher,
    );

    const response = await provider.chat({
      model: "@cf/moonshotai/kimi-k2.7-code",
      messages: [{ role: "user", content: "Triage this" }],
      response_format: "json",
    });

    expect(response.content).toBe('{"decision":"ready-for-agent"}');
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account-id/ai/v1/chat/completions",
    );
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer secret-token",
    );
  });

  it("selects adapters without changing caller logic", () => {
    const provider = createProvider("openai", { OPENAI_API_KEY: "secret" });
    expect(provider.name).toBe("openai");
  });

  it("fails before a request when Cloudflare credentials are absent", async () => {
    const provider = new CloudflareProvider({}, vi.fn<typeof fetch>());
    await expect(
      provider.chat({ model: "model", messages: [] }),
    ).rejects.toThrow("CLOUDFLARE_ACCOUNT_ID");
  });
});
