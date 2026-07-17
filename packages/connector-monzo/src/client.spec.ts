import { describe, expect, test, vi } from "vitest";
import { MonzoClient, MonzoError } from "./client";

function client(
  fetch: typeof globalThis.fetch,
  options: { signal?: AbortSignal } = {},
) {
  return new MonzoClient({
    accessToken: "monzo-token",
    baseUrl: "http://localhost:8787",
    allowedHosts: ["localhost"],
    fetch,
    signal: options.signal,
    minRequestIntervalMs: 0,
  });
}

describe("MonzoClient", () => {
  test("authenticates with Bearer and parses accessible accounts", async () => {
    const fetch = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe("http://localhost:8787/accounts");
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer monzo-token",
        );
        expect(new Headers(init?.headers).get("user-agent")).toBe(
          "beancount-js-studio",
        );
        return new Response(
          JSON.stringify({
            accounts: [
              {
                id: "account-1",
                description: "Personal",
                created: "2020-01-01T00:00:00Z",
                type: "uk_retail",
              },
              { description: "Missing id" },
            ],
          }),
          { status: 200 },
        );
      },
    ) as typeof globalThis.fetch;

    await expect(client(fetch).getAccounts()).resolves.toEqual([
      {
        id: "account-1",
        description: "Personal",
        created: "2020-01-01T00:00:00Z",
        accountType: "uk_retail",
      },
    ]);
  });

  test("reads account currency from the balance endpoint", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe(
        "http://localhost:8787/balance?account_id=account-1",
      );
      return new Response(JSON.stringify({ currency: "gbp", balance: 1234 }), {
        status: 200,
      });
    }) as typeof globalThis.fetch;

    await expect(client(fetch).getBalance("account-1")).resolves.toEqual({
      currency: "GBP",
    });
  });

  test("queries transaction pages with merchant expansion and cursors", async () => {
    const urls: string[] = [];
    const fetch = vi.fn(async (input: string | URL | Request) => {
      urls.push(String(input));
      return new Response(
        JSON.stringify({
          transactions: [
            {
              id: "transaction-1",
              merchant: { id: "merchant-1", name: "Example Shop" },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof globalThis.fetch;
    const api = client(fetch);

    await api.getTransactionPage({
      accountId: "account-1",
      startTimestamp: "2026-04-18T12:00:00.000Z",
      endTimestamp: "2026-07-17T12:00:00.000Z",
    });
    await api.getTransactionPage({
      accountId: "account-1",
      startTimestamp: "2026-04-18T12:00:00.000Z",
      endTimestamp: "2026-07-17T12:00:00.000Z",
      since: "transaction-1",
    });

    expect(urls[0]).toContain("account_id=account-1");
    expect(urls[0]).toContain("since=2026-04-18T12%3A00%3A00.000Z");
    expect(urls[0]).toContain("before=2026-07-17T12%3A00%3A00.000Z");
    expect(urls[0]).toContain("limit=100");
    expect(urls[0]).toContain("expand%5B%5D=merchant");
    expect(urls[1]).toContain("since=transaction-1");
  });

  test("rejects redirects to another origin", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://api.monzo.com/stolen" },
        }),
    ) as typeof globalThis.fetch;

    await expect(client(fetch).getAccounts()).rejects.toMatchObject({
      errorType: "bad_request",
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  test("surfaces expired-token guidance", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
        }),
    ) as typeof globalThis.fetch;

    await expect(client(fetch).getAccounts()).rejects.toMatchObject({
      errorType: "unauthorized",
      message: expect.stringContaining("replace MONZO_ACCESS_TOKEN"),
    });
  });

  test("adds re-authentication guidance for blocked older history", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ message: "strong customer authentication" }),
          {
            status: 403,
          },
        ),
    ) as typeof globalThis.fetch;

    await expect(
      client(fetch).getTransactionPage({
        accountId: "account-1",
        startTimestamp: "2025-01-01T00:00:00.000Z",
        endTimestamp: "2026-07-17T00:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      errorType: "access_forbidden",
      message: expect.stringContaining("run the initial sync immediately"),
    });
  });

  test("surfaces rate-limit retry guidance", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: "Slow down" }), {
          status: 429,
          headers: { "retry-after": "12" },
        }),
    ) as typeof globalThis.fetch;

    const promise = client(fetch).getAccounts();
    await expect(promise).rejects.toBeInstanceOf(MonzoError);
    await expect(promise).rejects.toMatchObject({
      errorType: "rate_limited",
      retryAfter: "12",
      message: "Monzo rate limit exceeded. Retry after 12.",
    });
  });

  test("honors cancellation", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    const fetch = vi.fn() as unknown as typeof globalThis.fetch;

    await expect(
      client(fetch, { signal: controller.signal }).getAccounts(),
    ).rejects.toThrow("cancelled");
    expect(fetch).not.toHaveBeenCalled();
  });
});
