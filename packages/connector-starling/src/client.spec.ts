import { describe, expect, test, vi } from "vitest";
import { StarlingClient, StarlingError } from "./client";

function client(fetch: typeof globalThis.fetch) {
  return new StarlingClient({
    accessToken: "starling-token",
    baseUrl: "http://localhost:8787",
    allowedHosts: ["localhost"],
    fetch,
    minRequestIntervalMs: 0,
  });
}

describe("StarlingClient", () => {
  test("authenticates with Bearer and parses accessible accounts", async () => {
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe("http://localhost:8787/api/v2/accounts");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer starling-token",
        );
        expect(new Headers(init?.headers).get("user-agent")).toBe(
          "beancount-js-studio",
        );
        return new Response(
          JSON.stringify({
            accounts: [
              {
                accountUid: "account-1",
                defaultCategory: "category-1",
                name: "Personal",
                currency: "GBP",
                accountType: "PRIMARY",
              },
              { accountUid: "incomplete" },
            ],
          }),
          { status: 200 },
        );
      },
    ) as typeof globalThis.fetch;

    await expect(client(fetch).getAccounts()).resolves.toEqual([
      {
        accountUid: "account-1",
        defaultCategory: "category-1",
        name: "Personal",
        currency: "GBP",
        accountType: "PRIMARY",
        createdAt: undefined,
      },
    ]);
  });

  test("queries historical pages and follows same-origin links", async () => {
    const urls: string[] = [];
    const fetch = vi.fn(async (input: string | URL | Request) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          feedItems: [{ feedItemUid: "item-1", status: "SETTLED" }],
          links: { next: "http://localhost:8787/next-page?cursor=2" },
        }),
        { status: 200 },
      );
    }) as typeof globalThis.fetch;
    const api = client(fetch);

    const first = await api.getTransactionPage({
      accountUid: "account-1",
      categoryUid: "category-1",
      minTransactionTimestamp: "2026-01-01T00:00:00.000Z",
      maxTransactionTimestamp: "2026-07-17T00:00:00.000Z",
    });
    await api.getTransactionPage({
      accountUid: "account-1",
      categoryUid: "category-1",
      minTransactionTimestamp: "ignored",
      maxTransactionTimestamp: "ignored",
      nextUrl: first.next,
    });

    expect(urls[0]).toContain("/paginated-transactions?");
    expect(urls[0]).toContain(
      "minTransactionTimestamp=2026-01-01T00%3A00%3A00.000Z",
    );
    expect(urls[1]).toBe("http://localhost:8787/next-page?cursor=2");
  });

  test("rejects pagination links on another origin", async () => {
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;
    await expect(
      client(fetch).getTransactionPage({
        accountUid: "account-1",
        categoryUid: "category-1",
        minTransactionTimestamp: "ignored",
        maxTransactionTimestamp: "ignored",
        nextUrl: "https://api.starlingbank.com/stolen",
      }),
    ).rejects.toMatchObject({ errorType: "bad_request" });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("surfaces rate-limit retry guidance", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ errors: [{ message: "Slow down" }] }), {
          status: 429,
          headers: { "retry-after": "12" },
        }),
    ) as typeof globalThis.fetch;

    const promise = client(fetch).getAccounts();
    await expect(promise).rejects.toBeInstanceOf(StarlingError);
    await expect(promise).rejects.toMatchObject({
      errorType: "rate_limited",
      retryAfter: "12",
      message: "Starling rate limit exceeded. Retry after 12.",
    });
  });
});
