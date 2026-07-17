import { describe, expect, test, vi } from "vitest";
import { discoverMonzoAccounts, MonzoSource } from "./source";
import type { MonzoConfig, MonzoTransaction } from "./types";

const config: MonzoConfig = {
  secretRef: "env:MONZO_ACCESS_TOKEN",
  baseUrl: "http://localhost:8787",
  allowedHosts: ["localhost"],
  lookbackDays: 30,
};

async function collect(
  source: MonzoSource,
  fetch: typeof globalThis.fetch,
  limits: { maxPages?: number; maxRecords?: number } = {},
) {
  const pages = [];
  for await (const page of source.read(config, {
    sourceId: "monzo:account-1",
    resolveSecret: async () => "token",
    fetch,
    ...limits,
    fetchContext: {
      accountId: "account-1",
      startTimestamp: "2026-04-18T12:00:00.000Z",
      endTimestamp: "2026-07-17T12:00:00.000Z",
    },
  })) {
    pages.push(page);
  }
  return pages;
}

function transactions(
  count: number,
  options: { settled?: boolean; lastId?: string } = {},
): MonzoTransaction[] {
  return Array.from({ length: count }, (_, index) => ({
    id:
      index === count - 1 && options.lastId
        ? options.lastId
        : `transaction-${index + 1}`,
    settled: options.settled === false ? "" : "2026-07-16T12:00:00.000Z",
  }));
}

describe("MonzoSource", () => {
  test("paginates from raw ids and continues after a pending-only page", async () => {
    const requests: string[] = [];
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("since=transaction-100")) {
        return new Response(
          JSON.stringify({
            transactions: [
              {
                id: "settled-101",
                settled: "2026-07-16T12:00:00.000Z",
              },
              { id: "pending-102", settled: "" },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          transactions: transactions(100, { settled: false }),
        }),
        { status: 200 },
      );
    }) as typeof globalThis.fetch;

    const pages = await collect(new MonzoSource(), fetch);
    expect(pages).toEqual([
      { records: [] },
      {
        records: [
          {
            id: "settled-101",
            settled: "2026-07-16T12:00:00.000Z",
          },
        ],
      },
    ]);
    expect(requests[1]).toContain("since=transaction-100");
  });

  test("rejects repeated pagination cursors", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            transactions: transactions(100, {
              settled: false,
              lastId: "repeat",
            }),
          }),
          { status: 200 },
        ),
    ) as typeof globalThis.fetch;

    await expect(collect(new MonzoSource(), fetch)).rejects.toThrow(
      "repeated transaction cursor",
    );
  });

  test("enforces page and settled-record limits", async () => {
    const fullPage = vi.fn(
      async () =>
        new Response(JSON.stringify({ transactions: transactions(100) }), {
          status: 200,
        }),
    ) as typeof globalThis.fetch;
    await expect(
      collect(new MonzoSource(), fullPage, { maxPages: 1 }),
    ).rejects.toThrow("exceeded 1 pages");

    const records = vi.fn(
      async () =>
        new Response(JSON.stringify({ transactions: transactions(2) }), {
          status: 200,
        }),
    ) as typeof globalThis.fetch;
    await expect(
      collect(new MonzoSource(), records, { maxRecords: 1 }),
    ).rejects.toThrow("more than 1 settled transaction");
  });

  test("discovers accounts and resolves their currencies sequentially", async () => {
    const requests: string[] = [];
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requests.push(url);
      if (url.endsWith("/accounts")) {
        return new Response(
          JSON.stringify({
            accounts: [
              { id: "personal", description: "Personal", type: "uk_retail" },
              {
                id: "joint",
                description: "Joint Account",
                type: "uk_retail_joint",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ currency: url.includes("joint") ? "EUR" : "GBP" }),
        { status: 200 },
      );
    }) as typeof globalThis.fetch;

    await expect(
      discoverMonzoAccounts(config, {
        sourceId: "monzo",
        resolveSecret: async () => "token",
        fetch,
      }),
    ).resolves.toEqual([
      {
        id: "personal",
        name: "Personal",
        currency: "GBP",
        institutionName: "Monzo Bank",
        status: "uk_retail",
      },
      {
        id: "joint",
        name: "Joint Account",
        currency: "EUR",
        institutionName: "Monzo Bank",
        status: "uk_retail_joint",
      },
    ]);
    expect(requests).toEqual([
      "http://localhost:8787/accounts",
      "http://localhost:8787/balance?account_id=personal",
      "http://localhost:8787/balance?account_id=joint",
    ]);
  });
});
