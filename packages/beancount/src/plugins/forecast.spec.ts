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

function forecastTransaction(
  narration: string,
  meta: Record<string, unknown> = {},
) {
  return recurringTransaction().copy({ narration, meta });
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

  test("preserves unmatched forecast entries and non-forecast directives", () => {
    const unmatched = forecastTransaction("Rent without a schedule");
    const regular = recurringTransaction().copy({ flag: "*" });

    const [entries, errors] = forecast(
      [unmatched, regular],
      defaultBeancountOptions(),
      "now: 2024-01-15",
    );

    expect(errors).toEqual([]);
    expect(
      entries.map((entry) => [
        (entry as Transaction).flag,
        (entry as Transaction).narration,
      ]),
    ).toEqual([
      ["*", "Rent [MONTHLY REPEAT 3 TIMES]"],
      ["#", "Rent without a schedule"],
    ]);
  });

  test("supports RFC and natural-language recurrence rules", () => {
    const rfc = forecastTransaction("Rent [FREQ=MONTHLY;COUNT=2]");
    const natural = forecastTransaction("Gym [Every week]");

    const [entries, errors] = forecast(
      [rfc, natural],
      defaultBeancountOptions(),
      "now: 2024-01-15\nend: 2024-02-01",
    );

    expect(errors).toEqual([]);
    expect(entries).toHaveLength(5);
    expect(
      entries.map((entry) => (entry as Transaction).narration.trim()),
    ).toEqual(["Gym", "Gym", "Rent", "Gym", "Gym"]);
  });

  test("records an invalid declared end while retaining the default horizon", () => {
    const entry = forecastTransaction("Rent [MONTHLY REPEAT 2 TIMES]", {
      end: "not a date",
    });

    const [entries, errors] = forecast(
      [entry],
      defaultBeancountOptions(),
      "now: 2024-01-15",
    );

    expect(entries).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Invalid forecast value for 'end'");
  });

  test("supports yearly, daily, skip, and until recurrence variants", () => {
    const yearly = forecastTransaction("Insurance [YEARLY REPEAT 2 TIMES]");
    const weekly = forecastTransaction(
      "Gym [WEEKLY SKIP 1 TIME REPEAT 2 TIMES]",
    );
    const daily = forecastTransaction("Coffee [DAILY UNTIL 2024-01-03]");

    const [entries, errors] = forecast(
      [yearly, weekly, daily],
      defaultBeancountOptions(),
      "now: 2024-01-01",
    );

    expect(errors).toEqual([]);
    expect(
      entries.map((entry) => [
        entry.date?.toISODate(),
        (entry as Transaction).narration.trim(),
      ]),
    ).toEqual([
      ["2024-01-01", "Insurance"],
      ["2024-01-01", "Gym"],
      ["2024-01-01", "Coffee"],
      ["2024-01-02", "Coffee"],
      ["2024-01-03", "Coffee"],
      ["2024-01-15", "Gym"],
      ["2025-01-01", "Insurance"],
    ]);
  });
});
