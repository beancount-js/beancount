import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Balance, Posting, Price, Transaction } from "../core/data";
import { validateNoDuplicates } from "./noduplicates";

const date = DateTime.fromISO("2024-01-01");

describe("no duplicates plugin", () => {
  test("reports duplicate transactions", () => {
    const transaction = new Transaction(
      date,
      "*",
      "",
      "Duplicate",
      [],
      [],
      [new Posting("Assets:Cash", new Amount("1", "USD"))],
    );
    const [, errors] = validateNoDuplicates([transaction, transaction.copy()]);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Duplicate entry");
  });

  test("allows duplicate balance and price directives", () => {
    const balance = new Balance(date, "Assets:Cash", new Amount("1", "USD"));
    const price = new Price(date, "HOOL", new Amount("10", "USD"));
    const [, errors] = validateNoDuplicates([
      balance,
      balance.copy(),
      price,
      price,
    ]);

    expect(errors).toEqual([]);
  });
});
