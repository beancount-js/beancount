import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import {
  Amount,
  Balance,
  Close,
  Open,
  Posting,
  Transaction,
  defaultBeancountOptions,
} from "../core";
import { checkDrained } from "./check_drained";

describe("check drained plugin", () => {
  test("adds next-day zero checks for declared and seen account currencies", () => {
    const date = DateTime.fromISO("2024-01-01");
    const [entries, errors] = checkDrained(
      [
        new Open(date, "Assets:Cash", ["USD", "CAD"]),
        new Transaction(
          date,
          "*",
          "",
          "Use",
          [],
          [],
          [new Posting("Assets:Cash", new Amount("1", "EUR"))],
        ),
        new Close(DateTime.fromISO("2024-02-01"), "Assets:Cash"),
      ],
      defaultBeancountOptions(),
    );
    const balances = entries.filter(
      (entry): entry is Balance => entry instanceof Balance,
    );
    expect(errors).toEqual([]);
    expect(
      balances.map((entry) => [entry.date.toISODate(), entry.amount.currency]),
    ).toEqual([
      ["2024-02-02", "USD"],
      ["2024-02-02", "CAD"],
      ["2024-02-02", "EUR"],
    ]);
  });

  test("keeps an explicit close-date balance and does not check income accounts", () => {
    const closeDate = DateTime.fromISO("2024-02-01");
    const [entries] = checkDrained(
      [
        new Open(DateTime.fromISO("2024-01-01"), "Assets:Cash", ["USD", "CAD"]),
        new Open(DateTime.fromISO("2024-01-01"), "Income:Salary", ["USD"]),
        new Balance(closeDate, "Assets:Cash", new Amount("1", "USD")),
        new Close(closeDate, "Assets:Cash"),
        new Close(closeDate, "Income:Salary"),
      ],
      defaultBeancountOptions(),
    );

    const balances = entries.filter(
      (entry): entry is Balance => entry instanceof Balance,
    );
    expect(
      balances.map((entry) => [
        entry.date.toISODate(),
        entry.account,
        entry.amount.currency,
      ]),
    ).toEqual([
      ["2024-02-01", "Assets:Cash", "USD"],
      ["2024-02-02", "Assets:Cash", "CAD"],
    ]);
  });
});
