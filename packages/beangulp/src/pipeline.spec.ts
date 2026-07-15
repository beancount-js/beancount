import { describe, expect, test } from "vitest";
import {
  HistoricalCategorizer,
  MerchantRuleCategorizer,
  RecurringCategorizer,
} from "./categorize";
import { ArraySource } from "./json-api";
import { proposalTransaction, runIngestion } from "./pipeline";

const sourceAccount = "Assets:Bank:Current";
const history = ["2026-04-01", "2026-05-01", "2026-06-01"].map((bookedAt) => ({
  sourceAccount,
  merchant: "Tesco",
  category: "Expenses:Food:Groceries",
  amount: "-42.00",
  bookedAt,
}));

describe("runIngestion", () => {
  test("normalizes, deduplicates, explains suggestions, and renders reviewed entries", async () => {
    const run = await runIngestion({
      source: new ArraySource<{
        id: string;
        date: string;
        amount: string;
        merchant: string;
      }>(),
      sourceConfig: [
        {
          id: "txn-1",
          date: "2026-07-01",
          amount: "-42.00",
          merchant: "Tesco",
        },
        {
          id: "txn-1",
          date: "2026-07-01",
          amount: "-42.00",
          merchant: "Tesco",
        },
      ],
      sourceId: "bank",
      sourceAccount,
      fetchedAt: "2026-07-02T00:00:00.000Z",
      availableAccounts: ["Expenses:Food:Groceries", "Expenses:Food:Dining"],
      history,
      normalizer: {
        kind: "test",
        normalize(record, context) {
          return {
            ok: true,
            transaction: {
              sourceId: context.sourceId,
              sourceAccount: context.sourceAccount,
              externalId: record.id,
              bookedAt: record.date,
              amount: record.amount,
              currency: "GBP",
              merchant: record.merchant,
              narration: record.merchant,
              status: "posted",
              fetchedAt: context.fetchedAt,
              metadata: {},
            },
          };
        },
      },
      categorizers: [
        new MerchantRuleCategorizer([]),
        new HistoricalCategorizer(),
        new RecurringCategorizer(),
      ],
    });

    expect(run.summary).toMatchObject({ total: 2, ready: 1, duplicates: 1 });
    const proposal = run.proposals[0];
    expect(proposal.suggestions[0]).toMatchObject({
      account: "Expenses:Food:Groceries",
      method: "history",
      explanation: expect.stringContaining(
        "historically been posted there 3 times",
      ),
    });
    expect(
      proposalTransaction(proposal, "Expenses:Food:Groceries").toString(),
    ).toContain('import_id: "bank:txn-1"');
    expect(
      proposalTransaction(proposal, "Expenses:Food:Groceries").toString(),
    ).toContain("category_score:");
    expect(
      proposalTransaction(proposal, "Expenses:Food:Groceries").toString(),
    ).not.toContain("category_confidence:");
  });

  test("proposalTransaction emits tags links and user metadata", () => {
    const rendered = proposalTransaction(
      {
        id: "proposal:tags",
        importId: "bank:txn-tags",
        status: "ready",
        suggestions: [],
        selectedAccount: "Expenses:Food:Dining",
        issues: [],
        transaction: {
          sourceId: "bank",
          sourceAccount: "Assets:Bank:Checking",
          bookedAt: "2026-07-01",
          amount: "-4.00",
          currency: "GBP",
          payee: "Cafe",
          narration: "Latte",
          status: "posted",
          fetchedAt: "2026-07-02T00:00:00.000Z",
          tags: ["coffee"],
          links: ["receipt-9"],
          metadata: { tip: "yes" },
        },
      },
      "Expenses:Food:Dining",
    ).toString();
    expect(rendered).toContain("#coffee");
    expect(rendered).toContain("^receipt-9");
    expect(rendered).toContain('tip: "yes"');
  });

  test("emits onProgress during fetch and process stages", async () => {
    const progress: Array<{ stage: string; pagesFetched?: number }> = [];
    await runIngestion({
      source: new ArraySource<{
        id: string;
        date: string;
        amount: string;
        merchant: string;
      }>(),
      sourceConfig: [
        {
          id: "txn-progress-1",
          date: "2026-07-01",
          amount: "-10.00",
          merchant: "Cafe",
        },
      ],
      sourceId: "bank",
      sourceAccount,
      fetchedAt: "2026-07-02T00:00:00.000Z",
      availableAccounts: ["Expenses:Food:Dining"],
      normalizer: {
        kind: "test",
        normalize(record, context) {
          return {
            ok: true,
            transaction: {
              sourceId: context.sourceId,
              sourceAccount: context.sourceAccount,
              externalId: record.id,
              bookedAt: record.date,
              amount: record.amount,
              currency: "GBP",
              merchant: record.merchant,
              narration: record.merchant,
              status: "posted",
              fetchedAt: context.fetchedAt,
              metadata: {},
            },
          };
        },
      },
      onProgress: (event) => {
        progress.push({
          stage: event.stage,
          pagesFetched: event.pagesFetched,
        });
      },
    });

    expect(progress.some((event) => event.stage === "fetch")).toBe(true);
    expect(progress.some((event) => event.stage === "process")).toBe(true);
    expect(progress.at(-1)?.stage).toBe("complete");
  });

  test("skips AI after an exact merchant rule", async () => {
    let aiCalls = 0;
    await runIngestion({
      source: new ArraySource<{ id: string }>(),
      sourceConfig: [{ id: "txn-2" }],
      sourceId: "bank",
      sourceAccount,
      fetchedAt: "2026-07-02T00:00:00.000Z",
      normalizer: {
        kind: "test",
        normalize(record, context) {
          return {
            ok: true,
            transaction: {
              sourceId: context.sourceId,
              sourceAccount: context.sourceAccount,
              externalId: record.id,
              bookedAt: "2026-07-01",
              amount: "-1.00",
              currency: "GBP",
              merchant: "Tesco",
              narration: "Tesco",
              status: "posted",
              fetchedAt: context.fetchedAt,
              metadata: {},
            },
          };
        },
      },
      categorizers: [
        new MerchantRuleCategorizer([
          { merchant: "Tesco", account: "Expenses:Food:Groceries" },
        ]),
        {
          id: "ai",
          isAi: true,
          async suggest() {
            aiCalls += 1;
            return [];
          },
        },
      ],
    });

    expect(aiCalls).toBe(0);
  });

  test("resolves a confirmed merchant before categorization and memoizes it per run", async () => {
    let resolverCalls = 0;
    const seenMerchantIds: Array<string | undefined> = [];
    const run = await runIngestion({
      source: new ArraySource<{ id: string }>(),
      sourceConfig: [{ id: "one" }, { id: "two" }],
      sourceId: "bank",
      sourceAccount,
      fetchedAt: "2026-07-02T00:00:00.000Z",
      normalizer: {
        kind: "test",
        normalize(record, context) {
          return {
            ok: true,
            transaction: {
              sourceId: context.sourceId,
              sourceAccount: context.sourceAccount,
              externalId: record.id,
              bookedAt: record.id === "two" ? "2026-07-02" : "2026-07-01",
              amount: "-12.00",
              currency: record.id === "two" ? "EUR" : "GBP",
              merchant: "TSC* 123",
              narration: "TSC* 123",
              status: "posted",
              fetchedAt: context.fetchedAt,
              metadata: {},
            },
          };
        },
      },
      merchantResolvers: [
        {
          id: "profiles",
          async resolve({ resolution }) {
            resolverCalls += 1;
            return {
              status: "confirmed",
              rawLabel: resolution.rawLabel ?? "TSC* 123",
              merchant: {
                merchantId: "merchant-tesco",
                canonicalName: "Tesco",
                aliases: [],
                provenance: [
                  { source: "alias", observedAt: "2026-07-02T00:00:00.000Z" },
                ],
              },
              explanation: "Matched a confirmed alias.",
            };
          },
        },
      ],
      categorizers: [
        {
          id: "confirmed-only",
          async suggest(context) {
            seenMerchantIds.push(context.merchant?.merchantId);
            return [
              {
                account: "Expenses:Food:Groceries",
                rawScore: 1,
                scoreKind: "history-frequency",
                support: 4,
                method: "history",
                explanation: "Confirmed merchant history.",
                evidence: [],
              },
            ];
          },
        },
      ],
    });

    expect(resolverCalls).toBe(1);
    expect(seenMerchantIds).toEqual(["merchant-tesco", "merchant-tesco"]);
    expect(
      run.proposals.every(
        (proposal) => proposal.merchantResolution?.status === "confirmed",
      ),
    ).toBe(true);
  });

  test("keeps AI merchant suggestions out of categorizer context until confirmed", async () => {
    let merchantId: string | undefined;
    await runIngestion({
      source: new ArraySource<{ id: string }>(),
      sourceConfig: [{ id: "one" }],
      sourceId: "bank",
      sourceAccount,
      normalizer: {
        kind: "test",
        normalize(record, context) {
          return {
            ok: true,
            transaction: {
              sourceId: context.sourceId,
              sourceAccount: context.sourceAccount,
              externalId: record.id,
              bookedAt: "2026-07-01",
              amount: "-12.00",
              currency: "GBP",
              merchant: "COFFEE 123",
              narration: "COFFEE 123",
              status: "posted",
              fetchedAt: context.fetchedAt,
              metadata: {},
            },
          };
        },
      },
      merchantResolvers: [
        {
          id: "advisor",
          async resolve({ resolution }) {
            return {
              status: "suggested",
              rawLabel: resolution.rawLabel ?? "COFFEE 123",
              candidates: [
                {
                  id: "ai:coffee",
                  canonicalName: "Coffee Shop",
                  rawScore: 0.9,
                  explanation: "AI suggestion.",
                  provenance: [
                    { source: "ai", observedAt: "2026-07-02T00:00:00.000Z" },
                  ],
                },
              ],
              explanation: "AI suggestion.",
            };
          },
        },
      ],
      categorizers: [
        {
          id: "inspect",
          async suggest(context) {
            merchantId = context.merchant?.merchantId;
            return [];
          },
        },
      ],
    });

    expect(merchantId).toBeUndefined();
  });
});
