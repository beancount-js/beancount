import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Amount } from "./amount";
import {
  Balance,
  Close,
  Document,
  findAccountsWithComponent,
  findClosest,
  iterateEntryRange,
  Open,
  Posting,
  removePosting,
  sorted,
  Transaction,
} from "./data";

describe("Transaction metadata", () => {
  test("serializes underscored importer metadata keys", () => {
    const transaction = new Transaction(
      DateTime.fromISO("2026-07-01"),
      "*",
      "Tesco",
      "Groceries",
      [],
      [],
      [
        new Posting("Assets:Bank:Current", new Amount("-12.50", "GBP")),
        new Posting("Expenses:Food:Groceries"),
      ],
      { import_id: "bank:txn-1", category_confidence: 1 },
    );

    expect(transaction.toString()).toContain('import_id: "bank:txn-1"');
    expect(transaction.toString()).toContain("category_confidence: 1");
  });
});

describe("directive helpers", () => {
  test("sorts directives without mutating the original sequence", () => {
    const date = DateTime.fromISO("2024-01-01");
    const transaction = new Transaction(date, "*", "", "Payment");
    const entries = [
      new Close(date, "Assets:Cash"),
      transaction,
      new Document(date, "Assets:Cash", "statement.pdf"),
      new Balance(date, "Assets:Cash", new Amount("0", "USD")),
      new Open(date, "Assets:Cash"),
    ];

    expect(sorted(entries).map((entry) => entry.directiveType)).toEqual([
      "open",
      "balance",
      "transaction",
      "document",
      "close",
    ]);
    expect(entries[0]).toBeInstanceOf(Close);
  });

  test("finds accounts, ranges, and the closest dated directive", () => {
    const jan = DateTime.fromISO("2024-01-01");
    const feb = DateTime.fromISO("2024-02-01");
    const mar = DateTime.fromISO("2024-03-01");
    const entries = [
      new Open(jan, "Assets:Cash"),
      new Open(feb, "Assets:Savings"),
      new Open(mar, "Expenses:Food"),
    ];

    expect([...findAccountsWithComponent(entries, "Assets")]).toEqual([
      "Assets:Cash",
      "Assets:Savings",
    ]);
    expect([...iterateEntryRange(entries, feb, mar)]).toEqual([entries[1]]);
    expect(findClosest(entries, DateTime.fromISO("2024-02-15"))).toBe(
      entries[1],
    );
  });

  test("removes only the requested posting from a transaction copy", () => {
    const first = new Posting("Assets:Cash", new Amount("10", "USD"));
    const second = new Posting("Income:Salary", new Amount("-10", "USD"));
    const transaction = new Transaction(
      DateTime.fromISO("2024-01-01"),
      "*",
      "",
      "Salary",
      [],
      [],
      [first, second],
    );

    const withoutFirst = removePosting(transaction, first);
    expect(withoutFirst.postings).toEqual([second]);
    expect(transaction.postings).toEqual([first, second]);
  });
});
