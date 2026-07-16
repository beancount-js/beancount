import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Amount } from "../core/amount";
import { newMetadata, Posting, Transaction } from "../core/data";
import { defaultBeancountOptions } from "../core/options";
import { renderEntryContext, renderFileContext } from "./context";

function transaction(
  date: string,
  line: number,
  narration: string,
  postings: Posting[],
): Transaction {
  return new Transaction(
    DateTime.fromISO(date),
    "*",
    "",
    narration,
    [],
    [],
    postings,
    newMetadata("ledger.bean", line),
  );
}

describe("context rendering", () => {
  test("renders transaction balances, residual diagnostics, and source lookup", () => {
    const opening = transaction("2024-01-01", 1, "Opening", [
      new Posting("Assets:Cash", new Amount("10", "USD")),
      new Posting("Equity:Opening-Balances", new Amount("-10", "USD")),
    ]);
    const purchase = transaction("2024-01-02", 4, "Lunch", [
      new Posting("Assets:Cash", new Amount("-2", "USD")),
      new Posting("Expenses:Food", new Amount("2", "USD")),
    ]);
    const entries = [opening, purchase];
    const options = defaultBeancountOptions();

    const rendered = renderEntryContext(entries, options, purchase);
    expect(rendered).toContain("** Transaction Id");
    expect(rendered).toContain("Location: ledger.bean:4");
    expect(rendered).toContain("** Balances before transaction");
    expect(rendered).toContain("Assets:Cash    10 USD");
    expect(rendered).toContain("** Transaction");
    expect(rendered).toContain("Lunch");
    expect(rendered).toContain("** Residual and Tolerances");
    expect(rendered).toContain("** Balances after transaction");
    expect(rendered).toContain("Assets:Cash    8 USD");
    expect(renderFileContext(entries, options, "ledger.bean", 5)).toBe(
      rendered,
    );
  });
});
