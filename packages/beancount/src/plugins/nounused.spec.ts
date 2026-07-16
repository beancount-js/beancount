import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Close, Open, Posting, Transaction } from "../core/data";
import { validateUnusedAccounts } from "./nounused";

describe("unused accounts plugin", () => {
  test("allows posted and closed accounts but reports unused opens", () => {
    const date = DateTime.fromISO("2024-01-01");
    const unused = new Open(date, "Assets:Unused");
    const [, errors] = validateUnusedAccounts([
      new Open(date, "Assets:Used"),
      new Open(date, "Assets:Closed"),
      unused,
      new Transaction(
        date,
        "*",
        "",
        "Use",
        [],
        [],
        [new Posting("Assets:Used", new Amount("1", "USD"))],
      ),
      new Close(DateTime.fromISO("2024-02-01"), "Assets:Closed"),
    ]);

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Unused account 'Assets:Unused'");
    expect(errors[0].context.directive).toBe(unused);
  });
});
