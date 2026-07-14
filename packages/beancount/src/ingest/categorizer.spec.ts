import { describe, test, expect } from "vitest";
import { Categorizer, RecordMatcher } from "./categorizer";
import exp from "constants";

describe("Categorizer.RecordMatcher", () => {
  const categorizer = new Categorizer({
    posting: new RecordMatcher(
      {
        datex: ["^date:(.+)"],
        date: ["^date:(.+)"],
        payee: ["^memo:(.+)"],
        amount: ["^amount:(.+)"],
      },
      { index: 1 },
    ),
    accounts: new RecordMatcher({}),
  });
  test("infer tolerance", () => {
    const input = {
      Number: "\t0",
      Date: "29/07/2024",
      Account: "20-38-83 40027189",
      Amount: "100.00",
      Subcategory: "Counter Credit",
      Memo: "AKUOM MA              \tMARY AKUOM BGC\t",
      $Account: "Expenses:Uncategorized",
    };
    expect(categorizer.directive(input, "Expenses:Food")).toBeNull();
  });
});
