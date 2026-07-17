import { describe, expect, test } from "vitest";
import { MonzoNormalizer } from "./normalize";
import type { MonzoTransaction } from "./types";

const context = {
  sourceId: "monzo:account-1",
  sourceAccount: "Assets:Bank:Monzo",
  defaultCurrency: "GBP",
  fetchedAt: "2026-07-17T09:00:00.000Z",
};

function settled(overrides: Partial<MonzoTransaction> = {}): MonzoTransaction {
  return {
    id: "transaction-1",
    amount: -1234,
    currency: "GBP",
    description: "EXAMPLE SHOP",
    created: "2026-07-16T10:00:00.000Z",
    settled: "2026-07-17T01:00:00.000Z",
    notes: "Card purchase",
    category: "shopping",
    is_load: false,
    merchant: { id: "merchant-1", name: "Example Shop" },
    ...overrides,
  };
}

describe("MonzoNormalizer", () => {
  test("normalizes a signed merchant purchase from minor units", () => {
    const result = new MonzoNormalizer().normalize(settled(), context);
    expect(result).toEqual({
      ok: true,
      transaction: expect.objectContaining({
        externalId: "transaction-1",
        bookedAt: "2026-07-17",
        amount: "-12.34",
        currency: "GBP",
        merchant: "Example Shop",
        payee: undefined,
        narration: "Card purchase",
        status: "posted",
        metadata: {
          monzo_category: "shopping",
          monzo_description: "EXAMPLE SHOP",
          monzo_created: "2026-07-16T10:00:00.000Z",
          monzo_is_load: "false",
          monzo_merchant_id: "merchant-1",
        },
      }),
    });
  });

  test("normalizes inbound non-merchant transactions as payees", () => {
    const result = new MonzoNormalizer().normalize(
      settled({
        amount: "500",
        merchant: null,
        description: "Alex Example",
        notes: "Shared dinner",
      }),
      context,
    );
    expect(result).toEqual({
      ok: true,
      transaction: expect.objectContaining({
        amount: "5.00",
        merchant: undefined,
        payee: "Alex Example",
        narration: "Shared dinner",
      }),
    });
  });

  test("uses ISO currency fraction digits", () => {
    const result = new MonzoNormalizer().normalize(
      settled({ amount: 1234, currency: "JPY" }),
      context,
    );
    expect(result).toEqual({
      ok: true,
      transaction: expect.objectContaining({ amount: "1234", currency: "JPY" }),
    });
  });

  test("rejects malformed and unsettled transactions", () => {
    const normalizer = new MonzoNormalizer();
    expect(normalizer.normalize(settled({ id: undefined }), context)).toEqual({
      ok: false,
      message: "Transaction is missing its id.",
    });
    expect(normalizer.normalize(settled({ amount: "12.5" }), context)).toEqual({
      ok: false,
      message: "Transaction is missing a valid amount.",
    });
    expect(normalizer.normalize(settled({ settled: "" }), context)).toEqual({
      ok: false,
      message: "Transaction is missing a valid settlement time.",
    });
  });
});
