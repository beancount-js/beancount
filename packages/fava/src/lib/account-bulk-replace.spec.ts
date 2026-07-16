import {
  Balance,
  Close,
  Open,
  Pad,
  Posting,
  Transaction,
  Amount,
} from "@beancount-js/beancount";
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import {
  accountsInRecords,
  applyPatchesToContents,
  buildAccountReplacePatches,
  replaceAccountInDirective,
} from "./account-bulk-replace";
import type { JournalRecord } from "../components/journal-table/model";

const date = DateTime.fromISO("2024-01-15");

function transactionRecord(
  key: string,
  postings: Posting[],
): JournalRecord {
  const directive = new Transaction(
    date,
    "*",
    "Cafe",
    "Lunch",
    [],
    [],
    postings,
    { filename: "main.beancount", lineno: 10 },
  );
  return {
    key,
    directive,
    date,
    dateKey: "2024-01-15",
    title: "Cafe",
    detail: "Lunch",
    type: "*",
    postings: postings.map((posting) => ({
      account: posting.account,
      amount: posting.units ?? undefined,
    })),
  };
}

describe("replaceAccountInDirective", () => {
  test("renames matching transaction postings only", () => {
    const txn = new Transaction(
      date,
      "*",
      "",
      "Lunch",
      [],
      [],
      [
        new Posting("Assets:Cash", new Amount("-12.00", "USD")),
        new Posting("Expenses:Uncategorized", new Amount("12.00", "USD")),
      ],
    );
    const next = replaceAccountInDirective(
      txn,
      "Expenses:Uncategorized",
      "Expenses:Food",
    );
    expect(next).toBeInstanceOf(Transaction);
    expect((next as Transaction).postings.map((p) => p.account)).toEqual([
      "Assets:Cash",
      "Expenses:Food",
    ]);
  });

  test("returns undefined when From is absent", () => {
    const txn = new Transaction(
      date,
      "*",
      "",
      "Lunch",
      [],
      [],
      [new Posting("Assets:Cash"), new Posting("Expenses:Food")],
    );
    expect(
      replaceAccountInDirective(txn, "Expenses:Uncategorized", "Expenses:Food"),
    ).toBeUndefined();
  });

  test("renames Open / Close / Balance accounts", () => {
    expect(
      (replaceAccountInDirective(
        new Open(date, "Expenses:Uncategorized"),
        "Expenses:Uncategorized",
        "Expenses:Food",
      ) as Open).account,
    ).toBe("Expenses:Food");
    expect(
      (replaceAccountInDirective(
        new Close(date, "Expenses:Uncategorized"),
        "Expenses:Uncategorized",
        "Expenses:Food",
      ) as Close).account,
    ).toBe("Expenses:Food");
    expect(
      (replaceAccountInDirective(
        new Balance(date, "Expenses:Uncategorized", new Amount("0", "USD")),
        "Expenses:Uncategorized",
        "Expenses:Food",
      ) as Balance).account,
    ).toBe("Expenses:Food");
  });

  test("renames both Pad account fields when they match", () => {
    const pad = new Pad(date, "Expenses:Uncategorized", "Equity:Opening");
    const next = replaceAccountInDirective(
      pad,
      "Expenses:Uncategorized",
      "Expenses:Food",
    ) as Pad;
    expect(next.account).toBe("Expenses:Food");
    expect(next.sourceAccount).toBe("Equity:Opening");

    const both = replaceAccountInDirective(
      new Pad(date, "Expenses:A", "Expenses:A"),
      "Expenses:A",
      "Expenses:B",
    ) as Pad;
    expect(both.account).toBe("Expenses:B");
    expect(both.sourceAccount).toBe("Expenses:B");
  });
});

describe("accountsInRecords", () => {
  test("collects unique accounts from selection", () => {
    const records = [
      transactionRecord("a", [
        new Posting("Assets:Cash"),
        new Posting("Expenses:Uncategorized"),
      ]),
      transactionRecord("b", [
        new Posting("Assets:Cash"),
        new Posting("Expenses:Food"),
      ]),
    ];
    expect(accountsInRecords(records)).toEqual([
      "Assets:Cash",
      "Expenses:Food",
      "Expenses:Uncategorized",
    ]);
  });
});

describe("buildAccountReplacePatches / applyPatchesToContents", () => {
  test("skips records without source attachment", () => {
    const records = [
      transactionRecord("a", [
        new Posting("Assets:Cash"),
        new Posting("Expenses:Uncategorized"),
      ]),
    ];
    const { patches, skipped, changedCount } = buildAccountReplacePatches(
      records,
      "Expenses:Uncategorized",
      "Expenses:Food",
    );
    expect(patches).toHaveLength(0);
    expect(skipped).toEqual(["a"]);
    expect(changedCount).toBe(0);
  });

  test("applies patches from end to start", () => {
    const contents = "AAAA\nBBBB\nCCCC\n";
    const next = applyPatchesToContents(contents, [
      {
        path: "main.beancount",
        from: 0,
        to: 5,
        original: "AAAA\n",
        next: "XXXX\n",
        recordKey: "1",
      },
      {
        path: "main.beancount",
        from: 5,
        to: 10,
        original: "BBBB\n",
        next: "YYYY\n",
        recordKey: "2",
      },
    ]);
    expect(next).toBe("XXXX\nYYYY\nCCCC\n");
  });

  test("throws on conflicting original content", () => {
    expect(() =>
      applyPatchesToContents("AAAA\n", [
        {
          path: "main.beancount",
          from: 0,
          to: 5,
          original: "ZZZZ\n",
          next: "XXXX\n",
          recordKey: "1",
        },
      ]),
    ).toThrow(/changed in another editor/i);
  });
});
