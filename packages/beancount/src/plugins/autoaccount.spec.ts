import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Open, Posting, Transaction } from "../core/data";
import { autoInsertOpen } from "./autoaccount";

function transaction(date: string, accounts: string[]) {
  return new Transaction(
    DateTime.fromISO(date),
    "*",
    "",
    "Transaction",
    [],
    [],
    accounts.map(
      (account, index) =>
        new Posting(account, new Amount(index ? "-1" : "1", "USD")),
    ),
  );
}

describe("auto-account plugin", () => {
  test("inserts one open directive at each account's first use", () => {
    const [entries, errors] = autoInsertOpen([
      transaction("2024-02-01", ["Assets:Cash", "Income:Salary"]),
      transaction("2024-01-01", ["Assets:Cash", "Expenses:Food"]),
    ]);
    const opens = entries.filter(
      (entry): entry is Open => entry instanceof Open,
    );

    expect(errors).toEqual([]);
    expect(
      opens.map((entry) => [entry.account, entry.date.toISODate()]),
    ).toEqual([
      ["Assets:Cash", "2024-01-01"],
      ["Expenses:Food", "2024-01-01"],
      ["Income:Salary", "2024-02-01"],
    ]);
    expect(opens.every((entry) => entry.meta["<auto_accounts>"] === 0)).toBe(
      true,
    );
  });

  test("does not replace an explicit open directive", () => {
    const explicit = new Open(DateTime.fromISO("2023-01-01"), "Assets:Cash");
    const [entries] = autoInsertOpen([
      transaction("2024-01-01", ["Assets:Cash", "Income:Salary"]),
      explicit,
    ]);

    expect(entries.filter((entry) => entry instanceof Open)).toContain(
      explicit,
    );
    expect(
      entries.filter(
        (entry) => entry instanceof Open && entry.account === "Assets:Cash",
      ),
    ).toEqual([explicit]);
  });
});
