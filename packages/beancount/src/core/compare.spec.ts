import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "./amount";
import {
  compareEntries,
  excludesEntries,
  hashEntries,
  hashEntry,
  includesEntries,
} from "./compare";
import { Open, Price } from "./data";

describe("directive comparison", () => {
  test("hashes semantically equal entries without source metadata equally", () => {
    const date = DateTime.fromISO("2024-01-01");
    const left = new Open(date, "Assets:Cash", ["USD"], undefined, {
      filename: "left",
      lineno: 1,
    });
    const right = new Open(date, "Assets:Cash", ["USD"], undefined, {
      filename: "right",
      lineno: 2,
    });
    expect(hashEntry(left)).not.toBe(hashEntry(right));
    expect(hashEntry(left, true)).toBe(hashEntry(right, true));
    expect(compareEntries([left], [right])).toEqual([true, [], []]);
  });

  test("reports missing, included, excluded, and duplicate entries", () => {
    const date = DateTime.fromISO("2024-01-01");
    const usd = new Open(date, "Assets:Cash", ["USD"]);
    const cad = new Open(date, "Assets:Cash", ["CAD"]);
    expect(includesEntries([usd], [usd, cad])).toEqual([true, []]);
    expect(excludesEntries([usd], [cad])).toEqual([true, []]);
    expect(excludesEntries([usd], [usd])).toEqual([false, [usd]]);
    expect(hashEntries([usd, usd])[1]).toHaveLength(1);
    const price = new Price(date, "HOOL", new Amount("10", "USD"));
    expect(hashEntries([price, price])[1]).toEqual([]);
  });
});
