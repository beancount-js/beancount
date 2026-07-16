import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Balance, Open, Posting, Transaction } from "../core/data";
import { validateLeafOnly } from "./leafonly";

const date = DateTime.fromISO("2024-01-01");

function transaction(account: string) {
  return new Transaction(
    date,
    "*",
    "",
    "Posting",
    [],
    [],
    [
      new Posting(account, new Amount("1", "USD")),
      new Posting("Assets:Cash", new Amount("-1", "USD")),
    ],
  );
}

describe("leaf-only plugin", () => {
  test("reports one error for a posted non-leaf account", () => {
    const parent = new Open(date, "Expenses:Food");
    const [entries, errors] = validateLeafOnly([
      parent,
      new Open(date, "Expenses:Food:Restaurant"),
      new Open(date, "Assets:Cash"),
      transaction("Expenses:Food"),
    ]);

    expect(entries).toHaveLength(4);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Expenses:Food");
    expect(errors[0].context.directive).toBe(parent);
  });

  test("permits transaction postings to leaf accounts and balances on parents", () => {
    const [, errors] = validateLeafOnly([
      new Open(date, "Expenses:Food"),
      new Open(date, "Expenses:Food:Restaurant"),
      new Open(date, "Assets:Cash"),
      transaction("Expenses:Food:Restaurant"),
      new Balance(date, "Expenses:Food", new Amount("1", "USD")),
    ]);

    expect(errors).toEqual([]);
  });
});
