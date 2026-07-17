import { describe, expect, test } from "vitest";
import { StarlingNormalizer } from "./normalize";
import type { StarlingFeedItem } from "./types";

const context = {
  sourceId: "starling:account-1",
  sourceAccount: "Assets:Bank:Starling",
  defaultCurrency: "GBP",
  fetchedAt: "2026-07-17T09:00:00.000Z",
};

function settled(overrides: Partial<StarlingFeedItem> = {}): StarlingFeedItem {
  return {
    feedItemUid: "feed-1",
    amount: { currency: "GBP", minorUnits: 1234 },
    direction: "OUT",
    status: "SETTLED",
    transactionTime: "2026-07-16T10:00:00.000Z",
    counterPartyType: "MERCHANT",
    counterPartyName: "Example Shop",
    reference: "Card purchase",
    ...overrides,
  };
}

describe("StarlingNormalizer", () => {
  test("normalizes an outbound merchant purchase from minor units", () => {
    const result = new StarlingNormalizer().normalize(
      settled({
        settlementTime: "2026-07-17T01:00:00.000Z",
        source: "MASTER_CARD",
        sourceSubType: "CONTACTLESS",
        spendingCategory: "GROCERIES",
        country: "GB",
        sourceAmount: { currency: "EUR", minorUnits: 1500 },
        exchangeRate: 0.8226,
      }),
      context,
    );
    expect(result).toEqual({
      ok: true,
      transaction: expect.objectContaining({
        externalId: "feed-1",
        bookedAt: "2026-07-17",
        amount: "-12.34",
        currency: "GBP",
        merchant: "Example Shop",
        payee: undefined,
        narration: "Card purchase",
        status: "posted",
        metadata: expect.objectContaining({
          starling_source: "MASTER_CARD",
          starling_source_subtype: "CONTACTLESS",
          starling_spending_category: "GROCERIES",
          starling_source_amount: "-15.00",
          starling_source_currency: "EUR",
        }),
      }),
    });
  });

  test("normalizes inbound non-merchant counterparties as payees", () => {
    const result = new StarlingNormalizer().normalize(
      settled({
        amount: { currency: "GBP", minorUnits: 500 },
        direction: "IN",
        counterPartyType: "SENDER",
        counterPartyName: "Alex Example",
        userNote: "Shared dinner",
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
    const result = new StarlingNormalizer().normalize(
      settled({
        amount: { currency: "JPY", minorUnits: 1234 },
        direction: "IN",
      }),
      context,
    );
    expect(result).toEqual({
      ok: true,
      transaction: expect.objectContaining({ amount: "1234", currency: "JPY" }),
    });
  });

  test("rejects malformed feed items", () => {
    const normalizer = new StarlingNormalizer();
    expect(
      normalizer.normalize(settled({ feedItemUid: undefined }), context),
    ).toEqual({
      ok: false,
      message: "Transaction is missing its feed item id.",
    });
    expect(
      normalizer.normalize(settled({ direction: "SIDEWAYS" }), context),
    ).toEqual({ ok: false, message: "Transaction has an invalid direction." });
  });
});
