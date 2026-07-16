import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import {
  Amount,
  Balance,
  Commodity,
  Cost,
  Open,
  Posting,
  Price,
  Transaction,
} from "../core";
import {
  getCommodityMap,
  validateCommodityDirectives,
} from "./check_commodity";

const date = DateTime.fromISO("2011-05-17");

describe("check commodity plugin", () => {
  test("collects declared, posting, cost, price, balance, and metadata commodities", () => {
    const [occurrences, commodities] = getCommodityMap(
      [
        new Commodity(date, "BAZ"),
        new Open(date, "Expenses:Test", ["TEST1", "TEST2"]),
        new Transaction(
          date,
          "*",
          "",
          "",
          [],
          [],
          [
            new Posting(
              "Assets:Investments",
              new Amount("5", "FOO"),
              new Cost(date, new Amount("1", "TEST3")),
              new Amount("1", "TEST4"),
              "",
              { related: "TEST5" },
            ),
          ],
          { related: "TEST6" },
        ),
        new Balance(date, "Assets:Investments", new Amount("0", "TEST7")),
        new Price(date, "BAR", new Amount("1", "TEST8")),
      ],
      true,
    );

    expect(new Set(occurrences.map(([, currency]) => currency))).toEqual(
      new Set([
        "TEST1",
        "TEST2",
        "FOO",
        "TEST3",
        "TEST4",
        "TEST5",
        "TEST6",
        "TEST7",
        "BAR",
        "TEST8",
      ]),
    );
    expect([...commodities.keys()]).toEqual(["BAZ"]);
  });

  test("reports undeclared account-context commodities once and supports account/currency ignores", () => {
    const entries = [
      new Commodity(date, "USD"),
      new Transaction(
        date,
        "*",
        "",
        "",
        [],
        [],
        [
          new Posting("Expenses:Restaurant", new Amount("1", "USD")),
          new Posting("Assets:Options", new Amount("1", "QQQ_041621C341")),
          new Posting(
            "Assets:Other",
            new Amount("1", "CAD"),
            null,
            new Amount("1", "USD"),
          ),
        ],
      ),
      new Price(date, "QQQ_041621C341", new Amount("1", "USD")),
    ];
    const [, errors] = validateCommodityDirectives(
      entries,
      undefined,
      "{ 'Assets:Options': 'QQQ_.*' }",
    );

    expect(errors.map((error) => error.message)).toEqual([
      "Missing Commodity directive for 'CAD' in 'Assets:Other'",
    ]);
  });

  test("returns a configuration error without inspecting entries", () => {
    const [, errors] = validateCommodityDirectives([], undefined, "[invalid]");
    expect(errors.map((error) => error.message)).toEqual([
      "Invalid configuration for check_commodity plugin; skipping.",
    ]);
  });
});
