import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount, Booking, Cost, Open, Posting, Transaction } from "../core";
import { validateAverageCost } from "./check_average_cost";

const account = "Assets:US:Retirement";
const date = DateTime.fromISO("2018-01-01");

function transaction(dateText: string, units: string, cost: string) {
  const transactionDate = DateTime.fromISO(dateText);
  return new Transaction(
    transactionDate,
    "*",
    "",
    "",
    [],
    [],
    [
      new Posting(
        account,
        new Amount(units, "MSFT"),
        new Cost(transactionDate, new Amount(cost, "USD")),
      ),
    ],
  );
}

describe("average cost plugin", () => {
  test("allows reductions within one percent of the prior average cost", () => {
    const entries = [
      new Open(date, account, [], Booking.NONE),
      transaction("2018-05-01", "100", "56.00"),
      transaction("2018-05-01", "100", "60.00"),
      transaction("2018-09-01", "-50", "58.58"),
    ];
    const [, errors] = validateAverageCost(entries);

    expect(errors).toEqual([]);
  });

  test("reports reductions outside the tolerance and accepts a configured tolerance", () => {
    const entries = [
      new Open(date, account, [], Booking.NONE),
      transaction("2018-05-01", "100", "56.00"),
      transaction("2018-05-01", "100", "60.00"),
      transaction("2018-09-01", "-50", "59.16"),
    ];
    const [, strictErrors] = validateAverageCost(entries);
    const [, relaxedErrors] = validateAverageCost(entries, undefined, "0.02");

    expect(strictErrors.map((error) => error.message)).toEqual([
      "Cost basis on reducing posting is too far from the average cost (59.16 vs. 58)",
    ]);
    expect(relaxedErrors).toEqual([]);
  });

  test("rejects non-float configuration", () => {
    expect(() => validateAverageCost([], undefined, "1")).toThrow(
      "Invalid configuration for check_average_cost: must be a float",
    );
  });
});
