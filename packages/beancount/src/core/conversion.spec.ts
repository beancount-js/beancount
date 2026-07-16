import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "./amount";
import {
  Conversion,
  conversionLabel,
  costOrValue,
  getConversion,
} from "./conversion";
import { CounterInventory } from "./inventory";
import { Cost } from "./position";
import { Price } from "./data";
import { PriceMap } from "./prices";

const date = DateTime.fromISO("2024-01-10");

describe("report conversion", () => {
  test("normalizes supported and unsupported conversion controls", () => {
    expect(getConversion(null)).toBe(Conversion.AT_COST);
    expect(getConversion("AT_VALUE")).toBe(Conversion.AT_VALUE);
    expect(getConversion("unknown")).toBe(Conversion.AT_COST);
    expect(conversionLabel(Conversion.AT_COST)).toBe("At Cost");
    expect(conversionLabel(Conversion.AT_VALUE)).toBe("At Value");
    expect(conversionLabel(Conversion.UNITS)).toBe("Units");
  });

  test("reduces counter inventories at cost, at value, or in units", () => {
    const inventory = new CounterInventory();
    inventory.add(
      new Amount("2", "HOOL"),
      new Cost(date, new Amount("5", "USD")),
    );
    inventory.add(new Amount("3", "USD"));
    const prices = new PriceMap([
      new Price(date, "HOOL", new Amount("10", "USD")),
    ]);

    expect(costOrValue(inventory, Conversion.AT_COST).toRecord()).toEqual({
      USD: 13,
    });
    expect(costOrValue(inventory, Conversion.UNITS).toRecord()).toEqual({
      HOOL: 2,
      USD: 3,
    });
    expect(
      costOrValue(inventory, Conversion.AT_VALUE, { prices, date }).toRecord(),
    ).toEqual({ USD: 23 });
    expect(costOrValue(inventory, Conversion.AT_VALUE).toRecord()).toEqual({
      USD: 13,
    });
  });
});
