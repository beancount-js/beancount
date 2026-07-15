import { describe, expect, test } from "vitest";
import { DateTime } from "luxon";
import { Amount } from "./amount";
import { Posting, Transaction } from "./data";

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
