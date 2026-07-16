import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount, Cost, Posting, Transaction } from "../core";
import {
  commodityPairKey,
  compressIntervalsDays,
  getCommodityLifetimes,
  requiredDailyPrices,
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
});
