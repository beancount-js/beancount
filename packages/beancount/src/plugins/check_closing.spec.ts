import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Balance, Posting, Transaction } from "../core/data";
import { checkClosing } from "./check_closing";

describe("check closing plugin", () => {
  test("replaces closing metadata with a next-day zero balance", () => {
    const transaction = new Transaction(
      DateTime.fromISO("2024-02-16"),
      "*",
      "",
      "Close option",
      [],
      [],
      [
        new Posting("Assets:Options", new Amount("-1", "OPT"), null, null, "", {
          closing: true,
        }),
      ],
    );
    const [entries, errors] = checkClosing([transaction]);
    const [updated, balance] = entries as [Transaction, Balance];

    expect(errors).toEqual([]);
    expect(updated.postings[0].meta.closing).toBeUndefined();
    expect(balance.date.toISODate()).toBe("2024-02-17");
    expect(balance.account).toBe("Assets:Options");
    expect(balance.amount.toString()).toBe("0 OPT");
  });
});
