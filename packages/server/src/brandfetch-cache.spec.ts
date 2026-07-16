import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { BrandfetchProvider } from "./brandfetch";
import { createBrandfetchResponseCache } from "./brandfetch-cache";
import { projectBrandfetchCacheRoot } from "./paths";

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

describe("Brandfetch response cache", () => {
  test("reuses a cached Brandfetch domain response without a second network call", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "brandfetch-cache-"));
    const cache = createBrandfetchResponseCache(projectRoot);
    let networkCalls = 0;
    const provider = new BrandfetchProvider({
      apiKey: "secret",
      clientId: "client-id",
      responseCache: cache,
      fetch: async () => {
        networkCalls += 1;
        return new Response(
          JSON.stringify({ id: "brand", name: "Tesco", domain: "tesco.com" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    const first = await provider.enrich(candidate);
    const second = await provider.enrich(candidate);

    expect(networkCalls).toBe(1);
    expect(first?.canonicalName).toBe("Tesco");
    expect(second?.canonicalName).toBe("Tesco");

    const names = await readdir(projectBrandfetchCacheRoot(projectRoot));
    const cached = names.find((name) => name.endsWith(".json"));
    expect(cached).toBeTruthy();
    const entry = JSON.parse(
      await readFile(
        join(projectBrandfetchCacheRoot(projectRoot), cached!),
        "utf8",
      ),
    );
    expect(entry).toMatchObject({
      version: 1,
      status: 200,
      url: expect.stringContaining("/v2/brands/domain/tesco.com"),
    });
  });

  test("caches 429 responses and avoids further network calls while fresh", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "brandfetch-429-"));
    const cache = createBrandfetchResponseCache(projectRoot);
    let networkCalls = 0;
    const provider = new BrandfetchProvider({
      apiKey: "secret",
      responseCache: cache,
      fetch: async () => {
        networkCalls += 1;
        return new Response("rate limited", { status: 429 });
      },
    });

    await expect(provider.enrich(candidate)).rejects.toThrow(/429/);
    await expect(provider.enrich(candidate)).rejects.toThrow(/429 \(cached\)/);
    expect(networkCalls).toBe(1);
  });

  test("uses Retry-After when caching a 429 response", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "brandfetch-retry-"));
    const cache = createBrandfetchResponseCache(projectRoot);
    const provider = new BrandfetchProvider({
      apiKey: "secret",
      responseCache: cache,
      fetch: async () =>
        new Response("rate limited", {
          status: 429,
          headers: {
            "retry-after": "120",
            "x-api-key-quota": "100",
            "x-api-key-approximate-usage": "100",
          },
        }),
    });

    await expect(provider.enrich(candidate)).rejects.toThrow(/retry after/);
    const cached = await cache.get(
      "GET",
      "https://api.brandfetch.io/v2/brands/domain/tesco.com",
    );
    expect(cached?.status).toBe(429);
    expect(cached?.rateLimit).toEqual({
      quota: 100,
      approximateUsage: 100,
      retryAfterSeconds: 120,
    });
    expect(Date.parse(cached!.expiresAt) - Date.parse(cached!.fetchedAt)).toBe(
      120_000,
    );
  });

  test("bypassCache still writes a fresh response into the cache", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "brandfetch-bypass-"));
    const cache = createBrandfetchResponseCache(projectRoot);
    let networkCalls = 0;
    const provider = new BrandfetchProvider({
      apiKey: "secret",
      responseCache: cache,
      bypassCache: true,
      fetch: async () => {
        networkCalls += 1;
        return new Response(
          JSON.stringify({ id: "brand", name: "Tesco", domain: "tesco.com" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    await provider.enrich(candidate);
    await provider.enrich(candidate);
    expect(networkCalls).toBe(2);

    const reader = new BrandfetchProvider({
      apiKey: "secret",
      responseCache: cache,
      fetch: async () => {
        throw new Error("network should not be used");
      },
    });
    await expect(reader.enrich(candidate)).resolves.toMatchObject({
      canonicalName: "Tesco",
    });
  });
});
