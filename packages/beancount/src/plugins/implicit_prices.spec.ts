import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Posting, Price, Transaction } from "../core/data";
import { Cost } from "../core/position";
import { addImplicitPrices, IMPLICIT_PRICES_META } from "./implicit_prices";

function transaction(postings: Posting[]) {
  return new Transaction(
    DateTime.fromISO("2024-01-01"),
    "*",
    "",
    "Trade",
    [],
    [],
    postings,
    { filename: "trade.bean", lineno: 12 },
  );
}

describe("implicit prices plugin", () => {
  test("adds a price for an explicit posting price exactly once", () => {
    const posting = new Posting(
      "Assets:Brokerage",
      new Amount("2", "HOOL"),
      null,
      new Amount("12.50", "USD"),
    );
    const [entries, errors] = addImplicitPrices([
      transaction([posting, posting]),
    ]);
    const prices = entries.filter(
      (entry): entry is Price => entry instanceof Price,
    );

    expect(errors).toEqual([]);
    expect(prices).toHaveLength(1);
    expect(prices[0].toString()).toContain("price HOOL 12.50 USD");
    expect(prices[0].meta[IMPLICIT_PRICES_META]).toBe("from_price");
  });

  test("adds cost prices only for augmenting lots", () => {
    const cost = new Cost(
      DateTime.fromISO("2024-01-01"),
      new Amount("10", "USD"),
    );
    const [entries] = addImplicitPrices([
      transaction([
        new Posting("Assets:Brokerage", new Amount("1", "HOOL"), cost),
      ]),
      transaction([
        new Posting("Assets:Brokerage", new Amount("-1", "HOOL"), cost),
      ]),
    ]);
    const prices = entries.filter(
      (entry): entry is Price => entry instanceof Price,
    );

    expect(prices).toHaveLength(1);
    expect(prices[0].meta[IMPLICIT_PRICES_META]).toBe("from_cost");
  });
});
