import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Posting, Price, Transaction } from "../core/data";
import { Cost } from "../core/position";
import {
  findBalanceCurrencies,
  findCurrenciesAtCost,
  findCurrenciesConverted,
  findCurrenciesPriced,
  findUnpricedCurrencies,
} from "./find_prices";

const date = DateTime.fromISO("2024-01-01");
const entries = [
  new Transaction(
    date,
    "*",
    "",
    "Trade",
    [],
    [],
    [
      new Posting(
        "Assets:Brokerage",
        new Amount("1", "HOOL"),
        new Cost(date, new Amount("10", "USD")),
      ),
      new Posting("Assets:Cash", new Amount("-10", "USD")),
      new Posting(
        "Assets:Foreign",
        new Amount("5", "EUR"),
        null,
        new Amount("1.1", "USD"),
      ),
      new Posting("Assets:Unpriced", new Amount("3", "GOLD")),
    ],
  ),
  new Price(DateTime.fromISO("2024-01-02"), "EUR", new Amount("1.2", "USD")),
];

function normalized(pairs: ReadonlySet<readonly [string, string]>) {
  return [...pairs].map((pair) => pair.join("/")).sort();
}

describe("price discovery", () => {
  test("finds cost, conversion, and declared price pairs", () => {
    expect(normalized(findCurrenciesAtCost(entries))).toEqual(["HOOL/USD"]);
    expect(normalized(findCurrenciesConverted(entries))).toEqual(["EUR/USD"]);
    expect(normalized(findCurrenciesPriced(entries))).toEqual(["EUR/USD"]);
  });

  test("keeps only balance-relevant pairs and identifies unpriced currencies", () => {
    expect(normalized(findBalanceCurrencies(entries))).toEqual([
      "EUR/USD",
      "HOOL/USD",
    ]);
    expect([...findUnpricedCurrencies(entries)]).toEqual(["USD", "GOLD"]);
  });

  test("excludes entries on and after the supplied date", () => {
    expect(
      normalized(findCurrenciesPriced(entries, DateTime.fromISO("2024-01-02"))),
    ).toEqual([]);
  });
});
