import { describe, expect, test } from "vitest";
import {
  discoverJsonApiAccounts,
  JsonApiSource,
  JsonMappingNormalizer,
  jsonApiAccountSourceId,
  jsonApiAccountTransactionsEndpoint,
} from "./json-api";

describe("JsonApiSource", () => {
  test("resolves a token at run time and follows a cursor", async () => {
    const requests: Request[] = [];
    const source = new JsonApiSource();
    const pages = source.read(
      {
        endpoint: "https://bank.example.test/transactions",
        secretRef: "env:BANK_TOKEN",
        recordsPath: "transactions",
        query: { account: "current" },
        pagination: { cursorQueryParam: "after", nextCursorPath: "next" },
      },
      {
        sourceId: "bank",
        resolveSecret: async (reference) =>
          reference === "env:BANK_TOKEN" ? "top-secret" : undefined,
        fetch: async (input, init) => {
          requests.push(new Request(input, init));
          return new Response(
            JSON.stringify(
              requests.length === 1
                ? { transactions: [{ id: "one" }], next: "cursor-2" }
                : { transactions: [{ id: "two" }] },
            ),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      },
    );

    const records: unknown[] = [];
    for await (const page of pages) records.push(...page.records);

    expect(records).toEqual([{ id: "one" }, { id: "two" }]);
    expect(requests).toHaveLength(2);
    expect(requests[0].headers.get("authorization")).toBe("Bearer top-secret");
    expect(requests[0].url).toContain("account=current");
    expect(requests[1].url).toContain("after=cursor-2");
  });

  test("sends X-API-Key when authScheme is x-api-key", async () => {
    const requests: Request[] = [];
    const source = new JsonApiSource();
    const pages = source.read(
      {
        endpoint: "https://lunchflow.app/api/v1/accounts/1/transactions",
        allowedHosts: ["lunchflow.app"],
        secretRef: "env:LUNCHFLOW_API_KEY",
        authScheme: "x-api-key",
        recordsPath: "transactions",
      },
      {
        sourceId: "lunchflow",
        resolveSecret: async () => "lf-secret",
        fetch: async (input, init) => {
          requests.push(new Request(input, init));
          return new Response(JSON.stringify({ transactions: [] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    );

    for await (const _page of pages) {
      /* drain */
    }

    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get("x-api-key")).toBe("lf-secret");
    expect(requests[0].headers.get("authorization")).toBeNull();
  });

  test("rejects insecure or unapproved endpoints before sending a token", async () => {
    const source = new JsonApiSource();
    let secretLookups = 0;
    const pages = source.read(
      {
        endpoint: "http://bank.example.test/transactions",
        secretRef: "env:BANK_TOKEN",
        allowedHosts: ["bank.example.test"],
      },
      {
        sourceId: "bank",
        resolveSecret: async () => {
          secretLookups += 1;
          return "top-secret";
        },
      },
    );

    await expect(pages[Symbol.asyncIterator]().next()).rejects.toThrow(
      "must use HTTPS",
    );
    expect(secretLookups).toBe(0);
  });
});

describe("JsonMappingNormalizer", () => {
  test("normalizes mapped data without retaining the raw record", () => {
    const normalizer = new JsonMappingNormalizer({
      id: "id",
      date: "settled_at",
      amount: "amount.value",
      currency: "amount.currency",
      merchant: "merchant.name",
      status: "state",
      amountSign: "invert",
    });

    const result = normalizer.normalize(
      {
        id: "txn-1",
        settled_at: "2026-07-01",
        amount: { value: "12.50", currency: "GBP" },
        merchant: { name: "Tesco" },
        state: "PENDING",
      },
      {
        sourceId: "bank",
        sourceAccount: "Assets:Bank:Current",
        fetchedAt: "2026-07-02T00:00:00.000Z",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      transaction: {
        externalId: "txn-1",
        bookedAt: "2026-07-01",
        amount: "-12.50",
        currency: "GBP",
        merchant: "Tesco",
        status: "pending",
      },
    });
    if (result.ok)
      expect(Object.keys(result.transaction.metadata)).toEqual([
        "raw_fingerprint",
      ]);
  });

  test("treats boolean pending flags as pending status", () => {
    const normalizer = new JsonMappingNormalizer({
      date: "date",
      amount: "amount",
      currency: "currency",
      status: "pending",
    });
    const result = normalizer.normalize(
      {
        date: "2026-07-01",
        amount: 10,
        currency: "GBP",
        pending: true,
      },
      {
        sourceId: "lunchflow",
        sourceAccount: "Assets:Bank:Current",
        fetchedAt: "2026-07-02T00:00:00.000Z",
      },
    );
    expect(result).toMatchObject({
      ok: true,
      transaction: { status: "pending", amount: "10" },
    });
  });

  test("treats Lunch Flow isPending boolean as pending", () => {
    const normalizer = new JsonMappingNormalizer({
      id: "id",
      date: "date",
      amount: "amount",
      currency: "currency",
      merchant: "merchant",
      narration: "description",
      status: "isPending",
    });
    const result = normalizer.normalize(
      {
        id: "tx-1",
        date: "2026-07-02",
        amount: "12.50",
        currency: "GBP",
        merchant: "Cafe",
        description: "Coffee",
        isPending: true,
      },
      {
        sourceId: "lunchflow:42",
        sourceAccount: "Assets:Bank:Current",
        fetchedAt: "2026-07-02T00:00:00.000Z",
      },
    );
    expect(result).toMatchObject({
      ok: true,
      transaction: {
        status: "pending",
        merchant: "Cafe",
        narration: "Coffee",
      },
    });
  });
});

describe("grouped JSON API helpers", () => {
  test("builds account transaction endpoints and ingest ids", () => {
    expect(
      jsonApiAccountTransactionsEndpoint(
        "https://lunchflow.app/api/v1/",
        "42",
      ),
    ).toBe("https://lunchflow.app/api/v1/accounts/42/transactions");
    expect(jsonApiAccountSourceId("lunchflow", "42")).toBe("lunchflow:42");
  });

  test("discovers accounts with x-api-key auth", async () => {
    const requests: Request[] = [];
    const accounts = await discoverJsonApiAccounts({
      baseUrl: "https://lunchflow.app/api/v1",
      secretRef: "env:LUNCHFLOW_API_KEY",
      authScheme: "x-api-key",
      allowedHosts: ["lunchflow.app"],
      resolveSecret: async () => "secret",
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return new Response(
          JSON.stringify({
            accounts: [
              {
                id: "42",
                name: "Current",
                currency: "GBP",
                institution_name: "Barclays",
                status: "active",
              },
              { id: "99", name: "" },
            ],
            total: 2,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://lunchflow.app/api/v1/accounts");
    expect(requests[0].headers.get("x-api-key")).toBe("secret");
    expect(accounts).toEqual([
      {
        id: "42",
        name: "Current",
        currency: "GBP",
        institutionName: "Barclays",
        status: "active",
        iban: undefined,
      },
    ]);
  });

  test("rejects discovery against hosts outside the allowlist", async () => {
    await expect(
      discoverJsonApiAccounts({
        baseUrl: "https://evil.example/api/v1",
        secretRef: "inline-key",
        allowedHosts: ["lunchflow.app"],
        resolveSecret: async () => "secret",
        fetch: async () => {
          throw new Error("should not fetch");
        },
      }),
    ).rejects.toThrow("allowlist");
  });
});
