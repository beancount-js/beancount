import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Posting, Transaction } from "../core/data";
import { defaultBeancountOptions } from "../core/options";
import { forecast } from "./forecast";

function recurringTransaction() {
  return new Transaction(
    DateTime.fromISO("2024-01-01"),
    "#",
    "",
    "Rent [MONTHLY REPEAT 3 TIMES]",
    [],
    [],
    [
      new Posting("Expenses:Rent", new Amount("1000", "USD")),
      new Posting("Assets:Cash", new Amount("-1000", "USD")),
    ],
  );
}

describe("forecast plugin", () => {
  test("expands a monthly repeat into dated forecast transactions", () => {
    const [entries, errors] = forecast(
      [recurringTransaction()],
      defaultBeancountOptions(),
      "now: 2024-01-15",
    );

    expect(errors).toEqual([]);
    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.date?.toISODate())).toEqual([
      "2024-01-01",
      "2024-02-01",
      "2024-03-01",
    ]);
    expect(entries.map((entry) => (entry as Transaction).flag)).toEqual([
      "#",
      "!",
      "!",
    ]);
    expect(
      entries.map((entry) => (entry as Transaction).narration.trim()),
    ).toEqual(["Rent", "Rent", "Rent"]);
  });

  test("returns the input and a validation error for invalid configuration", () => {
    const entry = recurringTransaction();
    const [entries, errors] = forecast(
      [entry],
      defaultBeancountOptions(),
      "now: 1",
    );

    expect(entries).toEqual([entry]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(
      "Invalid forecast plugin configuration",
    );
  });
});
