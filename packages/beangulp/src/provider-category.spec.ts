import { describe, expect, test } from "vitest";
import { ProviderCategoryCategorizer } from "./categorize";

const transaction = {
  sourceId: "monzo:account-1",
  sourceAccount: "Assets:Bank:Monzo",
  externalId: "transaction-1",
  bookedAt: "2026-07-18",
  amount: "-12.34",
  currency: "GBP",
  narration: "Shop",
  status: "posted" as const,
  fetchedAt: "2026-07-18T09:00:00.000Z",
  metadata: {},
  providerCategory: {
    provider: "monzo",
    code: "shopping",
    label: "Shopping",
  },
};

describe("ProviderCategoryCategorizer", () => {
  test("emits hard, explainable account evidence for a configured mapping", async () => {
    const categorizer = new ProviderCategoryCategorizer("monzo", [
      { code: "shopping", account: "Expenses:Shopping" },
    ]);
    await expect(
      categorizer.suggest({
        transaction,
        history: [],
        availableAccounts: ["Expenses:Shopping"],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        account: "Expenses:Shopping",
        hard: true,
        method: "provider",
        scoreKind: "provider-mapping",
        evidence: [
          expect.objectContaining({
            kind: "provider",
            summary: "Shopping (shopping) from monzo",
          }),
        ],
      }),
    ]);
  });

  test("defers to merchant rules and ignores unavailable or unmatched mappings", async () => {
    const categorizer = new ProviderCategoryCategorizer("monzo", [
      { code: "shopping", account: "Expenses:Shopping" },
    ]);
    await expect(
      categorizer.suggest({
        transaction,
        history: [],
        availableAccounts: ["Expenses:Food"],
      }),
    ).resolves.toEqual([]);
    await expect(
      categorizer.suggest({
        transaction,
        history: [],
        availableAccounts: ["Expenses:Shopping"],
        priorSuggestions: [
          {
            account: "Expenses:Food",
            rawScore: 1,
            hard: true,
            method: "rule",
            explanation: "Merchant rule",
            evidence: [],
          },
        ],
      }),
    ).resolves.toEqual([]);
  });
});
