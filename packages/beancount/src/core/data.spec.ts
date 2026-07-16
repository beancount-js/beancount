import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Amount } from "./amount";
import {
  Balance,
  Close,
  Document,
  findAccountsWithComponent,
  findClosestSource,
  hasEntryAccountComponent,
  findClosest,
  iterateEntryRange,
  Open,
  Posting,
  removePosting,
  removeAccountPostings,
  createSimplePosting,
  createSimplePostingWithCost,
  directiveSortKey,
  filterPostings,
  filterTransactions,
  getEntry,
  isDirective,
  isInstanceOf,
  newMetadata,
  optionKey,
  postingHasConversion,
  SOURCE_META,
  sorted,
  Transaction,
  transactionHasConversion,
  TxnPosting,
  writeScalar,
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
  test("creates source metadata and immutable simple postings", () => {
    const date = DateTime.fromISO("2024-01-01");
    const transaction = new Transaction(date, "*", "", "");
    expect(newMetadata("ledger.bean", 12, { key: "value" })).toEqual({
      filename: "ledger.bean",
      lineno: 12,
      key: "value",
    });
    expect(
      createSimplePosting("Assets:Cash", "10", "USD").toString(),
    ).toContain("10 USD");
    expect(
      createSimplePostingWithCost(
        transaction,
        "Assets:Invest",
        "1",
        "HOOL",
        "10",
        "USD",
      ).resolvedCost?.amount?.toString(),
    ).toBe("10 USD");
  });
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
    expect(removeAccountPostings("Assets:Cash", [transaction])[0]).not.toBe(
      transaction,
    );
    expect(hasEntryAccountComponent(transaction, "Salary")).toBe(true);
  });

  test("finds the closest preceding directive by source location", () => {
    const date = DateTime.fromISO("2024-01-01");
    const first = new Open(date, "Assets:Cash", [], undefined, {
      filename: "ledger.bean",
      lineno: 10,
    });
    const second = new Open(date, "Assets:Savings", [], undefined, {
      filename: "ledger.bean",
      lineno: 20,
    });
    expect(findClosestSource([first, second], "ledger.bean", 25)).toBe(second);
  });

  test("formats scalar metadata and keeps copies independent", () => {
    const date = DateTime.fromISO("2024-01-01");
    const original = new Transaction(
      date,
      "*",
      "Payee",
      "Narration",
      ["tag"],
      ["link"],
      [new Posting("Assets:Cash", new Amount("1", "USD"))],
      { category: "test" },
    );
    const copy = original.copy();

    expect(writeScalar(["quoted", date, new Amount("1", "USD")])).toBe(
      '"quoted" 2024-01-01 1 USD',
    );
    expect(copy.tags).not.toBe(original.tags);
    expect(copy.links).not.toBe(original.links);
    expect(copy.postings).not.toBe(original.postings);
    expect(copy.meta).not.toBe(original.meta);
    expect(copy.toString()).toContain("#tag ^link");
  });

  test("uses source metadata for stable directive identity", () => {
    const transaction = new Transaction(
      DateTime.fromISO("2024-01-01"),
      "*",
      "",
      "Narration",
      [],
      [],
      [],
      { [SOURCE_META]: "canonical source" },
    );

    expect(transaction.content).toBe("canonical source");
    expect(transaction.id).toBe(transaction.id);
    expect(transaction.id).not.toBe("");
  });

  test("identifies conversion postings and provides transaction posting views", () => {
    const priced = new Posting(
      "Assets:Cash",
      new Amount("1", "EUR"),
      null,
      new Amount("1.1", "USD"),
    );
    const transaction = new Transaction(
      DateTime.fromISO("2024-01-01"),
      "*",
      "",
      "Conversion",
      [],
      [],
      [priced],
    );
    const postingView = new TxnPosting(transaction, priced);

    expect(postingHasConversion(priced)).toBe(true);
    expect(transactionHasConversion(transaction)).toBe(true);
    expect(filterTransactions([transaction])).toEqual([transaction]);
    expect(filterPostings([transaction])).toEqual([postingView]);
    expect(getEntry(postingView)).toBe(transaction);
    expect(isInstanceOf(transaction, Transaction)).toBe(true);
    expect(isDirective(transaction)).toBe(true);
  });

  test("keeps directive ordering deterministic and normalizes option keys", () => {
    const date = DateTime.fromISO("2024-01-01");
    const laterLine = new Open(date, "Assets:Cash", [], undefined, {
      lineno: 20,
    });
    const earlierLine = new Open(date, "Assets:Savings", [], undefined, {
      lineno: 10,
    });

    expect(directiveSortKey(earlierLine)).toEqual([date.toMillis(), -2, 10]);
    expect(sorted([laterLine, earlierLine])).toEqual([earlierLine, laterLine]);
    expect(
      findClosest([earlierLine, laterLine], DateTime.fromISO("2024-01-01")),
    ).toBe(earlierLine);
    expect(optionKey(" Operating-Currency ")).toBe("operating_currency");
    expect(optionKey(null)).toBe("");
  });
});
