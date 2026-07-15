import { describe, expect, test } from "vitest";
import { BrandfetchProvider, brandfetchLogoUrl } from "./brandfetch";

const candidate = {
  id: "ai:tesco",
  canonicalName: "Tesco",
  domain: "tesco.com",
  rawScore: 0.9,
  explanation: "AI merchant suggestion.",
  provenance: [
    { source: "ai" as const, observedAt: "2026-07-15T12:00:00.000Z" },
  ],
};

describe("BrandfetchProvider", () => {
  test("validates an AI-suggested domain without sending a transaction label", async () => {
    const requests: Request[] = [];
    const provider = new BrandfetchProvider({
      apiKey: "secret",
      clientId: "client-id",
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(
          JSON.stringify({ id: "brand", name: "Tesco", domain: "tesco.com" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const enriched = await provider.enrich(candidate, {
      rawLabel: "TESCO STORES 1234",
      countryCode: "GB",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain("/v2/brands/domain/tesco.com");
    expect(requests[0].headers.get("authorization")).toBe("Bearer secret");
    expect(enriched).toMatchObject({
      canonicalName: "Tesco",
      domain: "tesco.com",
      logoUrl: brandfetchLogoUrl("tesco.com", "client-id"),
    });
  });

  test("does not submit raw transaction text unless transaction lookup is enabled", async () => {
    const requests: Request[] = [];
    const provider = new BrandfetchProvider({
      apiKey: "secret",
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response("{}", { status: 404 });
      },
    });

    await provider.enrich(
      { ...candidate, domain: undefined },
      { rawLabel: "PRIVATE RAW LABEL", countryCode: "GB" },
    );

    expect(requests).toHaveLength(0);
  });

  test("uses the transaction endpoint only when explicitly opted in", async () => {
    const requests: Request[] = [];
    const provider = new BrandfetchProvider({
      apiKey: "secret",
      allowTransactionLookup: true,
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(
          JSON.stringify({ id: "brand", name: "Tesco", domain: "tesco.com" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    await provider.enrich(
      { ...candidate, domain: undefined },
      { rawLabel: "TESCO STORES 1234", countryCode: "GB" },
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain("/v2/brands/transaction");
    await expect(requests[0].json()).resolves.toEqual({
      transactionLabel: "TESCO STORES 1234",
      countryCode: "GB",
    });
  });

  test("rejects a logo whose declared MIME type disagrees with its bytes", async () => {
    const provider = new BrandfetchProvider({
      apiKey: "secret",
      fetch: async () =>
        new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    });

    await expect(
      provider.downloadLogo("https://cdn.brandfetch.io/domain/tesco.com"),
    ).rejects.toThrow("PNG, JPEG, or WebP");
  });
});
