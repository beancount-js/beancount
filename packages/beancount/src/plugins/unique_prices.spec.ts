import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount, Price } from "../core";
import { validateUniquePrices } from "./unique_prices";

describe("unique prices plugin", () => {
  test("reports different same-day prices for a base and quote pair", () => {
    const date = DateTime.fromISO("2000-01-01");
    const prices = [
      new Price(date, "HOOL", new Amount("500.00", "USD")),
      new Price(date, "HOOL", new Amount("500.01", "USD")),
    ];
    const [entries, errors] = validateUniquePrices(prices);

    expect(entries).toBe(prices);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("Disagreeing price entries");
    expect(errors[0].context.entries).toEqual(prices);
  });

  test("allows repeated equal prices and distinct dates or quote currencies", () => {
    const sameDate = DateTime.fromISO("2000-01-01");
    const errors = validateUniquePrices([
      new Price(sameDate, "HOOL", new Amount("500.00", "USD")),
      new Price(sameDate, "HOOL", new Amount("500", "USD")),
      new Price(
        DateTime.fromISO("2000-01-02"),
        "HOOL",
        new Amount("501", "USD"),
      ),
      new Price(sameDate, "HOOL", new Amount("400", "CAD")),
    ])[1];

    expect(errors).toEqual([]);
  });
});
