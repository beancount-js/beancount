import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Balance, Open, Posting, Transaction } from "../core/data";
import { Cost } from "../core/position";
import { validateOneCommodity } from "./onecommodity";

const date = DateTime.fromISO("2024-01-01");

function transaction(account: string, currency: string, costCurrency?: string) {
  return new Transaction(
    date,
    "*",
    "",
    "Posting",
    [],
    [],
    [
      new Posting(
        account,
        new Amount("1", currency),
        costCurrency ? new Cost(date, new Amount("10", costCurrency)) : null,
      ),
    ],
  );
}

describe("one commodity plugin", () => {
  test("reports separate unit and cost currency violations", () => {
    const [, errors] = validateOneCommodity([
      new Open(date, "Assets:Brokerage"),
      transaction("Assets:Brokerage", "HOOL", "USD"),
      transaction("Assets:Brokerage", "AAPL", "CAD"),
    ]);

    expect(errors.map((error) => error.message)).toEqual([
      "More than one currency in account 'Assets:Brokerage': HOOL,AAPL",
      "More than one cost currency in account 'Assets:Brokerage': USD,CAD",
    ]);
  });

  test("honors explicit multi-currency declarations, metadata, and regex scope", () => {
    const [entries, declaredErrors] = validateOneCommodity([
      new Open(date, "Assets:Declared", ["USD", "CAD"]),
      transaction("Assets:Declared", "USD"),
      transaction("Assets:Declared", "CAD"),
    ]);
    const [, metadataErrors] = validateOneCommodity([
      new Open(date, "Expenses:Food", [], undefined, { onecommodity: false }),
      transaction("Expenses:Food", "USD"),
      transaction("Expenses:Food", "CAD"),
    ]);
    const [, regexErrors] = validateOneCommodity(
      [
        new Open(date, "Expenses:Food"),
        transaction("Expenses:Food", "USD"),
        transaction("Expenses:Food", "CAD"),
      ],
      undefined,
      "Assets:.*",
    );

    expect(entries).toHaveLength(3);
    expect(declaredErrors).toEqual([]);
    expect(metadataErrors).toEqual([]);
    expect(regexErrors).toEqual([]);
  });

  test("also considers balance directives", () => {
    const [, errors] = validateOneCommodity([
      new Open(date, "Expenses:Restaurant"),
      transaction("Expenses:Restaurant", "USD"),
      new Balance(
        DateTime.fromISO("2024-02-01"),
        "Expenses:Restaurant",
        new Amount("0", "CAD"),
      ),
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Expenses:Restaurant");
  });
});
