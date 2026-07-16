import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "../core/amount";
import { Open, Posting, Price, Transaction } from "../core/data";
import { auto } from "./auto";

describe("auto plugin", () => {
  test("composes automatic account openings and implicit prices", () => {
    const [entries, errors] = auto([
      new Transaction(
        DateTime.fromISO("2024-01-01"),
        "*",
        "",
        "Trade",
        [],
        [],
        [
          new Posting(
            "Assets:Brokerage",
            new Amount("1", "HOOL"),
            null,
            new Amount("10", "USD"),
          ),
          new Posting("Assets:Cash", new Amount("-10", "USD")),
        ],
      ),
    ]);

    expect(errors).toEqual([]);
    expect(entries.some((entry) => entry instanceof Open)).toBe(true);
    expect(entries.some((entry) => entry instanceof Price)).toBe(true);
  });
});
