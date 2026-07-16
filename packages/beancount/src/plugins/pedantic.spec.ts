import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import {
  Amount,
  Commodity,
  Open,
  Posting,
  Transaction,
  defaultBeancountOptions,
} from "../core";
import { pedantic } from "./pedantic";

describe("pedantic plugin bundle", () => {
  test("runs the upstream validator composition in order on a valid ledger", () => {
    const date = DateTime.fromISO("2014-02-01");
    const entries = [
      new Commodity(DateTime.fromISO("2010-01-01"), "USD"),
      new Commodity(DateTime.fromISO("2010-01-01"), "CAD"),
      new Open(DateTime.fromISO("2012-01-01"), "Assets:US:Checking", ["USD"]),
      new Open(DateTime.fromISO("2012-01-01"), "Assets:US:Savings", ["CAD"]),
      new Transaction(
        date,
        "*",
        "",
        "",
        [],
        [],
        [
          new Posting(
            "Assets:US:Checking",
            new Amount("100", "USD"),
            null,
            new Amount("1.01", "CAD"),
          ),
          new Posting("Assets:US:Savings", new Amount("-101", "CAD")),
        ],
      ),
    ];
    const [transformed, errors] = pedantic(entries, defaultBeancountOptions());

    expect(transformed).toEqual(entries);
    expect(errors).toEqual([]);
  });
});
