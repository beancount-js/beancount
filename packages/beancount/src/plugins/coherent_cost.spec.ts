import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount, Cost, Posting, Transaction } from "../core";
import { validateCoherentCost } from "./coherent_cost";

function transaction(date: string, posting: Posting) {
  return new Transaction(
    DateTime.fromISO(date),
    "*",
    "",
    "",
    [],
    [],
    [posting],
  );
}

describe("coherent cost plugin", () => {
  test("reports a currency that is used with and without a lot cost", () => {
    const costed = transaction(
      "2014-02-01",
      new Posting(
        "Assets:Invest:Shares",
        new Amount("2", "HOOL"),
        new Cost(DateTime.fromISO("2014-02-01"), new Amount("700.01", "USD")),
      ),
    );
    const plain = transaction(
      "2014-03-02",
      new Posting("Assets:Invest:Shares", new Amount("1", "HOOL")),
    );
    const [, errors] = validateCoherentCost([costed, plain]);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe(
      "Currency 'HOOL' is used both with and without cost",
    );
    expect(errors[0].context.directive).toBe(costed);
    expect(errors[0].context.conflictingDirective).toBe(plain);
  });

  test("allows currencies used consistently and skips incomplete postings", () => {
    const [, errors] = validateCoherentCost([
      transaction(
        "2014-02-01",
        new Posting("Assets:Cash", new Amount("1", "USD")),
      ),
      transaction("2014-03-02", new Posting("Assets:Cash", null)),
      transaction(
        "2014-03-03",
        new Posting(
          "Assets:Invest:Shares",
          new Amount("1", "HOOL"),
          new Cost(DateTime.fromISO("2014-03-03"), new Amount("700", "USD")),
        ),
      ),
    ]);

    expect(errors).toEqual([]);
  });
});
