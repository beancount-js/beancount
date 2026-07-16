import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Open, Posting, Transaction } from "../core/data";
import { compress, merge } from "./compress";

function transaction(date: string, narration: string, amount: string) {
  return new Transaction(
    DateTime.fromISO(date),
    "*",
    "",
    narration,
    ["daily"],
    ["source"],
    [
      new Posting("Expenses:Interest", new Amount(amount, "USD")),
      new Posting("Assets:Cash", new Amount(amount, "USD").neg()),
    ],
    { filename: "interest.bean", lineno: 1 },
  );
}

describe("transaction compression", () => {
  test("merges compatible postings while dropping posting metadata and tags", () => {
    const first = transaction("2024-01-01", "First", "1.11");
    const second = transaction("2024-01-02", "Second", "1.22");
    const merged = merge([first, second], first);

    expect(merged.date.toISODate()).toBe("2024-01-01");
    expect(merged.tags).toEqual([]);
    expect(merged.links).toEqual([]);
    expect(
      merged.postings.map((posting) => posting.toString(false).trim()),
    ).toEqual(["Assets:Cash -2.33 USD", "Expenses:Interest 2.33 USD"]);
  });

  test("only compresses consecutive transactions selected by the predicate", () => {
    const first = transaction("2024-01-01", "Daily", "1");
    const second = transaction("2024-01-02", "Daily", "2");
    const boundary = new Open(DateTime.fromISO("2024-01-03"), "Assets:Cash");
    const third = transaction("2024-01-04", "Daily", "3");

    const entries = compress(
      [first, second, boundary, third],
      (entry) => entry.narration === "Daily",
    );

    expect(entries).toHaveLength(3);
    expect(entries[0]).toBeInstanceOf(Transaction);
    expect((entries[0] as Transaction).date.toISODate()).toBe("2024-01-02");
    expect(entries[1]).toBe(boundary);
    expect((entries[2] as Transaction).date.toISODate()).toBe("2024-01-04");
  });
});
