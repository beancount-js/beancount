import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Decimal } from "@beancount-js/parser";
import { Amount } from "./amount";
import { Price } from "./data";
import { BaseQuote, PriceMap, normalizeBaseQuote } from "./prices";

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
});
