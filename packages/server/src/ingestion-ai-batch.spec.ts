import { describe, expect, test } from "vitest";
import type {
  CategorizationContext,
  MerchantResolutionContext,
  NormalizedTransaction,
} from "@beancount-js/beangulp";
import { CodexCategorizer, CodexMerchantAdvisor } from "./ingestion";

function transaction(id: string, merchant = `Merchant ${id} 123456`) {
  return {
    sourceId: "bank:current",
    sourceAccount: "Assets:Bank:Current",
    externalId: id,
    bookedAt: "2026-07-17",
    amount: "-123.45",
    currency: "GBP",
    merchant,
    narration: merchant,
    status: "posted",
    fetchedAt: "2026-07-17T09:00:00.000Z",
    metadata: { privateReference: "do-not-send" },
  } satisfies NormalizedTransaction;
}

function categoryContext(id: string): CategorizationContext {
  return {
    transaction: transaction(id),
    history: [],
    availableAccounts: ["Expenses:Food", "Expenses:Travel"],
    priorSuggestions: [
      {
        account: "Expenses:Food",
        method: "history",
        explanation: "Prior matching transaction.",
        rawScore: 0.6,
        scoreKind: "history-frequency",
        support: 1,
        evidence: [
          {
            id: `evidence:${id}`,
            kind: "history",
            summary: "Prior food purchase",
          },
        ],
      },
    ],
  };
}

describe("batched Codex enrichment adapters", () => {
  test("correlates out-of-order category results in one audited call", async () => {
    const prompts: string[] = [];
    const calls: unknown[] = [];
    const categorizer = new CodexCategorizer({
      execute: async (_args, prompt) => {
        prompts.push(prompt);
        const input = JSON.parse(prompt) as {
          transactions: Array<{ id: string }>;
        };
        return JSON.stringify({
          results: [...input.transactions].reverse().map(({ id }) => ({
            id,
            account: id === "first" ? "Expenses:Food" : "Expenses:Travel",
            rawScore: 0.92,
            evidenceIds: [`evidence:${id}`],
          })),
        });
      },
      onDebug: (call) => calls.push(call),
    });
    const first = categoryContext("first");
    first.transaction.providerCategory = {
      provider: "monzo",
      code: "groceries",
      label: "Groceries",
    };

    const results = await categorizer.suggestBatch([
      { id: "first", context: first },
      { id: "second", context: categoryContext("second") },
    ]);

    expect(prompts).toHaveLength(1);
    const input = JSON.parse(prompts[0]!) as {
      task: string;
      transactions: unknown[];
    };
    expect(input.task).toContain("non-authoritative bank evidence");
    expect(input.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "first",
          providerCategory: {
            provider: "monzo",
            code: "groceries",
            label: "Groceries",
          },
        }),
      ]),
    );
    expect(results).toEqual([
      expect.objectContaining({
        id: "second",
        value: [expect.objectContaining({ account: "Expenses:Travel" })],
      }),
      expect.objectContaining({
        id: "first",
        value: [expect.objectContaining({ account: "Expenses:Food" })],
      }),
    ]);
    expect(calls).toEqual([
      expect.objectContaining({
        ok: true,
        batchSize: 2,
        itemIds: ["first", "second"],
        durationMs: expect.any(Number),
        promptBytes: expect.any(Number),
        responseBytes: expect.any(Number),
      }),
    ]);
  });

  test("sends merchant advisor only its privacy-filtered batch input", async () => {
    let prompt = "";
    const advisor = new CodexMerchantAdvisor({
      countryCode: "GB",
      execute: async (_args, value) => {
        prompt = value;
        return JSON.stringify({
          results: [
            {
              id: "merchant:one",
              kind: "candidate",
              canonicalName: "Merchant One",
              domain: "merchant.example",
              description: null,
              industry: null,
              countryCode: "GB",
              rawScore: 0.9,
              explanation: "The label identifies Merchant One.",
            },
          ],
        });
      },
    });
    const context = {
      transaction: transaction("one", "MERCHANT ONE 123456"),
      resolution: {
        status: "unresolved" as const,
        rawLabel: "MERCHANT ONE 123456",
      },
    } satisfies MerchantResolutionContext;

    const [result] = await advisor.resolveBatch([
      { id: "merchant:one", context },
    ]);

    expect(result).toMatchObject({
      id: "merchant:one",
      value: {
        status: "suggested",
        candidates: [
          expect.objectContaining({ canonicalName: "Merchant One" }),
        ],
      },
    });
    expect(prompt).toContain('"normalizedLabel":"merchant one #"');
    expect(prompt).toContain('"sourceId":"bank:current"');
    expect(prompt).toContain('"currency":"GBP"');
    expect(prompt).not.toContain("-123.45");
    expect(prompt).not.toContain("Assets:Bank:Current");
    expect(prompt).not.toContain("privateReference");
  });

  test("rejects malformed batch identifiers instead of applying a result", async () => {
    const categorizer = new CodexCategorizer({
      execute: async () =>
        JSON.stringify({
          results: [
            {
              id: "first",
              account: "Expenses:Food",
              rawScore: 0.9,
              evidenceIds: [],
            },
            {
              id: "first",
              account: "Expenses:Food",
              rawScore: 0.9,
              evidenceIds: [],
            },
          ],
        }),
    });

    await expect(
      categorizer.suggestBatch([
        { id: "first", context: categoryContext("first") },
        { id: "second", context: categoryContext("second") },
      ]),
    ).rejects.toThrow("invalid category batch identifiers");
  });
});
