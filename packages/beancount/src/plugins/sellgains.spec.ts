import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import {
  Amount,
  Cost,
  Posting,
  Transaction,
  defaultBeancountOptions,
} from "../core";
import { validateSellGains } from "./sellgains";

const date = DateTime.fromISO("1999-07-31");

function sale(fee: string) {
  return new Transaction(
    date,
    "*",
    "",
    "Sell",
    [],
    [],
    [
      new Posting(
        "Assets:US:Company:ESPP",
        new Amount("-81", "ADSK"),
        new Cost(date, new Amount("26.3125", "USD")),
        new Amount("26.4375", "USD"),
      ),
      new Posting("Assets:US:Company:Cash", new Amount("2141.36", "USD")),
      new Posting("Expenses:Financial:Fees", new Amount(fee, "USD")),
      new Posting("Income:US:Company:ESPP:PnL", new Amount("-10.125", "USD")),
    ],
  );
}

describe("sell gains plugin", () => {
  test("accepts a priced sale when non-income proceeds match", () => {
    const [, errors] = validateSellGains(
      [sale("0.08")],
      defaultBeancountOptions(),
    );
    expect(errors).toEqual([]);
  });

  test("reports a priced sale when proceeds differ beyond tolerance", () => {
    const transaction = sale("1.08");
    const [, errors] = validateSellGains(
      [transaction],
      defaultBeancountOptions(),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Invalid price vs. proceeds/gains");
    expect(errors[0].context.directive).toBe(transaction);
  });

  test("does not validate transactions with an unpriced costed posting", () => {
    const transaction = sale("1.08").copy({
      postings: [
        new Posting(
          "Assets:US:Company:ESPP",
          new Amount("-81", "ADSK"),
          new Cost(date, new Amount("26.3125", "USD")),
        ),
      ],
    });
    expect(
      validateSellGains([transaction], defaultBeancountOptions())[1],
    ).toEqual([]);
  });
});
