import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount, Cost, Posting, Transaction } from "../core";
import {
  type CommodityLifetimes,
  commodityPairFromKey,
  commodityPairKey,
  compressLifetimesDays,
  compressIntervalsDays,
  getCommodityLifetimes,
  requiredDailyPrices,
  requiredWeeklyPrices,
  trimIntervals,
} from "./lifetimes";

const date = (value: string) => DateTime.fromISO(value);

function transaction(value: string, units: string) {
  const transactionDate = date(value);
  return new Transaction(
    transactionDate,
    "*",
    "",
    "",
    [],
    [],
    [
      new Posting(
        "Assets:Invest:AAPL",
        new Amount(units, "AAPL"),
        new Cost(date("2024-01-08"), new Amount("50", "USD")),
      ),
    ],
  );
}

describe("commodity lifetimes", () => {
  test("opens and closes global commodity-pair intervals from account inventory", () => {
    const lifetimes = getCommodityLifetimes([
      transaction("2024-01-08", "10"),
      transaction("2024-01-12", "-10"),
      transaction("2024-02-01", "5"),
    ]);
    expect(lifetimes.get(commodityPairKey(["AAPL", "USD"]))).toEqual([
      [date("2024-01-08"), date("2024-01-13")],
      [date("2024-02-01"), null],
    ]);
  });

  test("compresses, trims, and enumerates weekdays without duplicate zero-length intervals", () => {
    const intervals = [
      [date("2024-01-01"), date("2024-01-05")],
      [date("2024-01-10"), date("2024-01-20")],
    ] as const;
    expect(compressIntervalsDays(intervals, 6)).toEqual([
      [date("2024-01-01"), date("2024-01-20")],
    ]);
    expect(
      trimIntervals(intervals, date("2024-01-03"), date("2024-01-15")),
    ).toEqual([
      [date("2024-01-03"), date("2024-01-05")],
      [date("2024-01-10"), date("2024-01-15")],
    ]);
    const daily = requiredDailyPrices(
      new Map([
        [
          commodityPairKey(["AAPL", "USD"]),
          [[date("2024-01-05"), date("2024-01-05")]],
        ],
      ]),
      date("2024-02-01"),
      true,
    );
    expect(daily).toEqual([]);
  });

  test("round-trips pair keys and preserves separated interval boundaries", () => {
    const intervals = [
      [date("2024-01-01"), date("2024-01-02")],
      [date("2024-01-10"), null],
    ] as const;
    const key = commodityPairKey(["AAPL", "USD"]);

    expect(commodityPairFromKey(key)).toEqual(["AAPL", "USD"]);
    expect(commodityPairFromKey(commodityPairKey(["USD", null]))).toEqual([
      "USD",
      null,
    ]);
    expect(compressIntervalsDays(intervals, 2)).toEqual(intervals);
    expect(
      compressLifetimesDays(new Map([[key, [...intervals]]]), 2).get(key),
    ).toEqual(intervals);
    expect(() =>
      trimIntervals(intervals, date("2024-02-01"), date("2024-01-01")),
    ).toThrow("Trim end date is before start date");
  });

  test("enumerates daily and weekly price requirements only for costed lifetimes", () => {
    const lifetimes: CommodityLifetimes = new Map([
      [
        commodityPairKey(["AAPL", "USD"]),
        [[date("2024-01-01"), date("2024-01-03")]],
      ],
      [commodityPairKey(["USD", null]), [[date("2024-01-01"), null]]],
    ]);

    expect(
      requiredDailyPrices(lifetimes, date("2024-01-10")).map(
        ([when, base, quote]) => [when.toISODate(), base, quote],
      ),
    ).toEqual([
      ["2024-01-01", "AAPL", "USD"],
      ["2024-01-02", "AAPL", "USD"],
    ]);
    expect(
      requiredWeeklyPrices(lifetimes, date("2024-01-10")).map(
        ([when, base, quote]) => [when.toISODate(), base, quote],
      ),
    ).toEqual([["2023-12-29", "AAPL", "USD"]]);
  });
});
