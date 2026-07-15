import { describe, expect, test } from "vitest";
import { JsonApiSource, JsonMappingNormalizer } from "./json-api";

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
});
