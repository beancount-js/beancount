import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Decimal } from "@beancount-js/parser";
import { Amount } from "./amount";
import { Price } from "./data";
import {
  BaseQuote,
  getLastPriceEntries,
  PriceMap,
  normalizeBaseQuote,
} from "./prices";

function price(date: string, base: string, rate: string, quote: string) {
  return new Price(DateTime.fromISO(date), base, new Amount(rate, quote));
}

describe("PriceMap", () => {
  test("retains the last declaration for each day", () => {
    const prices = new PriceMap([
      price("2024-01-01", "HOOL", "10", "USD"),
      price("2024-01-01", "HOOL", "11", "USD"),
      price("2024-01-02", "HOOL", "12", "USD"),
    ]);

    expect(
      prices.getAllPrices("HOOL/USD").map((point) => point.units.toString()),
    ).toEqual(["11", "12"]);
    expect(prices.getPrice(new BaseQuote("HOOL", "USD"))).toEqual(
      prices.getAllPrices("HOOL/USD")[1].units,
    );
  });

  test("reconciles inverse declarations into the direction with more observations", () => {
    const prices = new PriceMap([
      price("2024-01-01", "HOOL", "10", "USD"),
      price("2024-01-03", "HOOL", "20", "USD"),
      price("2024-01-02", "USD", "0.25", "HOOL"),
    ]);

    expect(prices.forwardPairs.map((pair) => pair.hash)).toEqual(["HOOL USD"]);
    expect(
      prices
        .getAllPrices(["HOOL", "USD"])
        .map((point) => point.units.toString()),
    ).toEqual(["10", "4.00", "20"]);
    expect(
      prices.getPrice("USD/HOOL", DateTime.fromISO("2024-01-02"))?.toString(),
    ).toBe("0.25");
  });

  test("does not synthesize an inverse for zero rates and returns identity prices", () => {
    const prices = new PriceMap([price("2024-01-01", "HOOL", "0", "USD")]);

    expect(prices.getAllPrices("USD/HOOL")).toEqual([]);
    expect(prices.getPrice("USD/USD")).toEqual(Decimal.ONE);
    expect(normalizeBaseQuote("HOOL/USD").hash).toBe("HOOL USD");
  });

  test("normalizes pairs and supports dated, missing, and operating-currency lookups", () => {
    const entries = [
      price("2024-01-01", "EUR", "1.2", "USD"),
      price("2024-01-02", "EUR", "1.3", "USD"),
      price("2024-01-03", "USD", "0.7", "EUR"),
    ];
    const prices = new PriceMap(entries);

    expect(BaseQuote.from("EUR USD").inverse().toString()).toBe("USD EUR");
    expect(normalizeBaseQuote(["EUR", "USD"]).hash).toBe("EUR USD");
    expect(
      prices.commodityPairs(["EUR", "USD"]).map((pair) => pair.hash),
    ).toEqual(["EUR USD", "USD EUR"]);
    expect(prices.getLatestPrice("GBP/USD")).toBeNull();
    expect(
      prices.getPrice("EUR/USD", DateTime.fromISO("2023-12-31")),
    ).toBeUndefined();
    expect(
      prices.getPrice("EUR/USD", DateTime.fromISO("2024-01-01"))?.toString(),
    ).toBe("1.2");
    expect(
      getLastPriceEntries(entries, DateTime.fromISO("2024-01-03")).map(
        (entry) => entry.amount.toString(),
      ),
    ).toEqual(["1.3 USD"]);
  });
});
