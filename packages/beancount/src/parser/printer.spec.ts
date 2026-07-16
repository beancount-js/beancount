import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Amount } from "../core/amount";
import { Balance, newMetadata, Posting, Transaction } from "../core/data";
import { Cost } from "../core/position";
import {
  alignPositionStrings,
  formatError,
  formatEntry,
  formatTransaction,
  renderPostingStrings,
  renderSource,
} from "./printer";

describe("printer helpers", () => {
  test("matches upstream position alignment", () => {
    const [aligned, width] = alignPositionStrings([
      "45 HOOL {504.30 USD}",
      "4 HOOL {504.30 USD / 2014-11-11}",
      "9.9505 USD",
      "",
      "-22473.32 CAD @ 1.10 USD",
      "UNKNOWN",
      "76400.203",
    ]);
    expect(width).toBe(40);
    expect(aligned).toEqual([
      "       45 HOOL {504.30 USD}             ",
      "        4 HOOL {504.30 USD / 2014-11-11}",
      "   9.9505 USD                           ",
      "                                        ",
      "-22473.32 CAD @ 1.10 USD                ",
      "UNKNOWN                                 ",
      "76400.203                               ",
    ]);
  });

  test("renders source locations and directive errors", () => {
    const meta = newMetadata("ledger.bean", 12);
    const entry = new Balance(
      DateTime.fromISO("2024-01-01"),
      "Assets:Cash",
      new Amount(0, "USD"),
      null,
      "",
      meta,
    );
    expect(renderSource(meta)).toBe("ledger.bean:12:");
    expect(formatEntry(entry, "", true)).toContain("; source: ledger.bean:12:");
    expect(
      formatError({ message: "Example error", source: meta, entry }),
    ).toContain("ledger.bean:12: Example error");
  });

  test("renders posting components and only shows weights for non-trivial balances", () => {
    const transaction = new Transaction(
      DateTime.fromISO("2024-01-01"),
      "*",
      "",
      "Lunch",
      [],
      [],
      [
        new Posting("Assets:Cash", new Amount("-12.34", "USD")),
        new Posting("Expenses:Food", new Amount("12.34", "USD")),
      ],
    );
    expect(renderPostingStrings(transaction.postings[0])).toEqual([
      "Assets:Cash",
      "-12.34 USD",
      "-12.34 USD",
    ]);
    expect(formatTransaction(transaction, true)).toBe(
      [
        '2024-01-01 * "Lunch"',
        "  Assets:Cash    -12.34 USD",
        "  Expenses:Food   12.34 USD",
      ].join("\n"),
    );

    const costed = new Transaction(
      DateTime.fromISO("2024-01-02"),
      "*",
      "",
      "Purchase",
      [],
      [],
      [
        new Posting(
          "Assets:Brokerage",
          new Amount("1", "HOOL"),
          new Cost(DateTime.fromISO("2024-01-02"), new Amount("10", "USD")),
        ),
        new Posting("Assets:Cash", new Amount("-10", "USD")),
      ],
    );
    expect(formatTransaction(costed, true)).toMatch(/;\s+10 USD/);
  });
});
