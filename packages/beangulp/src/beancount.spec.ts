import { describe, expect, test } from "vitest";
import { proposalTransaction, transferTransaction } from "./beancount";
import type { ImportProposal } from "./types";

function proposal(overrides: Partial<ImportProposal> = {}): ImportProposal {
  return {
    id: "proposal-1",
    importId: "provider-1",
    status: "ready",
    selectedAccount: "Expenses:Food",
    suggestions: [],
    issues: [],
    transaction: {
      sourceId: "bank:checking",
      sourceAccount: "Assets:Bank:Checking",
      bookedAt: "2026-07-17",
      amount: "-12.34",
      currency: "GBP",
      narration: "Lunch",
      status: "posted",
      fetchedAt: "2026-07-17T09:00:00.000Z",
      metadata: {},
    },
    ...overrides,
  };
}

describe("proposalTransaction", () => {
  test("keeps provider provenance on the account posting and alternate source", () => {
    const rendered = proposalTransaction(proposal(), "Expenses:Food", {
      alternates: [
        proposal({
          id: "proposal-2",
          importId: "provider-2",
          transaction: {
            ...proposal().transaction!,
            sourceId: "aggregator:checking",
          },
        }),
      ],
    }).toString();
    expect(rendered).toContain('import_alt_1_id: "provider-2"');
    expect(rendered).toContain('import_id: "provider-1"');
    expect(rendered).toContain('    import_source: "bank:checking"');
  });
});

describe("transferTransaction", () => {
  test("renders two same-currency account legs without a category posting", () => {
    const rendered = transferTransaction(
      proposal(),
      proposal({
        id: "proposal-2",
        importId: "provider-2",
        transaction: {
          ...proposal().transaction!,
          sourceId: "bank:savings",
          sourceAccount: "Assets:Bank:Savings",
          amount: "12.34",
        },
      }),
    ).toString();
    expect(rendered).toContain("Assets:Bank:Checking -12.34 GBP");
    expect(rendered).toContain("Assets:Bank:Savings 12.34 GBP");
    expect(rendered).not.toContain("Expenses:Food");
  });

  test("renders provider-evidenced FX transfers with a balancing price", () => {
    const rendered = transferTransaction(
      proposal({
        transaction: {
          ...proposal().transaction!,
          amount: "-12.34",
          currency: "GBP",
          transferEvidence: {
            sourceAmount: { amount: "15", currency: "EUR" },
            exchangeRate: "0.8226",
          },
        },
      }),
      proposal({
        id: "proposal-2",
        transaction: {
          ...proposal().transaction!,
          sourceAccount: "Assets:Bank:EUR",
          amount: "15",
          currency: "EUR",
        },
      }),
    ).toString();
    expect(rendered).toContain(
      "Assets:Bank:EUR 15 EUR @ 0.82266666666666666667 GBP",
    );
    expect(rendered).toContain('provider_exchange_rate: "0.8226"');
  });
});
