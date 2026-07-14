import { describe, expect, test } from "vitest";
import { Amount, Custom, Posting, Transaction } from "@beancount-js/beancount";
import { DateTime } from "luxon";
import {
  groupJournalRecords,
  journalRecords,
  paginateJournalGroups,
} from "./model";

function transaction(
  date: string,
  payee: string,
  amount: string,
  account = "Assets:Checking",
) {
  return new Transaction(
    DateTime.fromISO(date),
    "*",
    payee,
    "Test record",
    [],
    [],
    [
      new Posting(account, new Amount(amount, "USD")),
      new Posting("Expenses:Food", new Amount(`-${amount}`, "USD")),
    ],
  );
}

describe("grouped journal model", () => {
  test("groups all dated directive types and calculates balance deltas", () => {
    const records = journalRecords([
      transaction("2026-04-03", "Dinner", "20"),
      new Custom(DateTime.fromISO("2026-04-03"), "marker", ["one"]),
      transaction("2026-04-02", "Coffee", "10"),
    ]);
    const groups = groupJournalRecords(records, {
      "2026-04-02": { USD: 100 },
      "2026-04-03": { USD: 120 },
    });

    expect(groups.map((group) => group.key)).toEqual([
      "2026-04-03",
      "2026-04-02",
    ]);
    expect(groups[0]?.records).toHaveLength(2);
    expect(groups[0]?.balance).toEqual({
      start: { USD: 100 },
      change: { USD: 20 },
      final: { USD: 120 },
    });
  });

  test("uses configured balance-sheet roots for the featured amount", () => {
    const record = journalRecords(
      [transaction("2026-04-03", "Card payment", "25", "Liabilities:Card")],
      ["Assets", "Liabilities"],
    )[0];

    expect(record?.posting?.account).toBe("Liabilities:Card");
    expect(record?.counterpart).toBe("Expenses:Food");
  });

  test("paginates whole date groups and leaves an oversized group intact", () => {
    const records = journalRecords([
      transaction("2026-04-03", "One", "1"),
      transaction("2026-04-03", "Two", "2"),
      transaction("2026-04-02", "Three", "3"),
      transaction("2026-04-01", "Four", "4"),
    ]);
    const groups = groupJournalRecords(records, {});
    const pages = paginateJournalGroups(groups, 2);

    expect(pages.map((page) => page.map((group) => group.key))).toEqual([
      ["2026-04-03"],
      ["2026-04-02", "2026-04-01"],
    ]);
  });
});
