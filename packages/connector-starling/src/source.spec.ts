import { describe, expect, test, vi } from "vitest";
import { StarlingSource } from "./source";
import type { StarlingConfig } from "./types";

const config: StarlingConfig = {
  secretRef: "env:STARLING_ACCESS_TOKEN",
  baseUrl: "http://localhost:8787",
  allowedHosts: ["localhost"],
  lookbackDays: 7,
};

async function collect(source: StarlingSource, fetch: typeof globalThis.fetch) {
  const pages = [];
  for await (const page of source.read(config, {
    sourceId: "starling:account-1",
    resolveSecret: async () => "token",
    fetch,
    fetchContext: {
      accountId: "account-1",
      mode: "history",
      startTimestamp: "2026-01-01T00:00:00.000Z",
      endTimestamp: "2026-07-17T00:00:00.000Z",
    },
  })) {
    pages.push(page);
  }
  return pages;
}

describe("StarlingSource", () => {
  test("resolves the default category, paginates, and keeps settled items", async () => {
    const requests: string[] = [];
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/api/v2/accounts")) {
        return new Response(
          JSON.stringify({
            accounts: [
              {
                accountUid: "account-1",
                defaultCategory: "category-1",
                name: "Personal",
                currency: "GBP",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("cursor=2")) {
        return new Response(
          JSON.stringify({
            feedItems: [{ feedItemUid: "settled-2", status: "SETTLED" }],
            links: {},
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          feedItems: [
            { feedItemUid: "settled-1", status: "SETTLED" },
            { feedItemUid: "pending-1", status: "PENDING" },
            { feedItemUid: "refunded-1", status: "REFUNDED" },
          ],
          links: { next: "http://localhost:8787/next?cursor=2" },
        }),
        { status: 200 },
      );
    }) as typeof globalThis.fetch;

    const pages = await collect(new StarlingSource(), fetch);
    expect(pages).toEqual([
      { records: [{ feedItemUid: "settled-1", status: "SETTLED" }] },
      { records: [{ feedItemUid: "settled-2", status: "SETTLED" }] },
    ]);
    expect(requests[1]).toContain("/account/account-1/category/category-1/");
    expect(requests[2]).toBe("http://localhost:8787/next?cursor=2");
  });

  test("fails without advancing when the record safety limit is exceeded", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/api/v2/accounts")) {
        return new Response(
          JSON.stringify({
            accounts: [
              {
                accountUid: "account-1",
                defaultCategory: "category-1",
                name: "Personal",
                currency: "GBP",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          feedItems: [
            { feedItemUid: "settled-1", status: "SETTLED" },
            { feedItemUid: "settled-2", status: "SETTLED" },
          ],
          links: {},
        }),
        { status: 200 },
      );
    }) as typeof globalThis.fetch;
    const source = new StarlingSource();

    const run = async () => {
      for await (const _page of source.read(config, {
        sourceId: "starling:account-1",
        resolveSecret: async () => "token",
        fetch,
        maxRecords: 1,
        fetchContext: {
          accountId: "account-1",
          mode: "history",
          startTimestamp: "2026-01-01T00:00:00.000Z",
          endTimestamp: "2026-07-17T00:00:00.000Z",
        },
      })) {
        // Iteration must complete for the source to be considered successful.
      }
    };
    await expect(run()).rejects.toThrow("more than 1 settled transaction");
  });
});
