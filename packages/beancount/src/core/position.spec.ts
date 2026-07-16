import { DateTime } from "luxon";
import { Decimal } from "@beancount-js/parser";
import { describe, expect, test } from "vitest";
import { Amount } from "./amount";
import {
  CostSpec,
  isTotalCostSpec,
  Position,
  positionFromString,
} from "./position";

describe("position helpers", () => {
  test("parses units and detailed cost specifications", () => {
    const position = positionFromString(
      '2 HOOL {10 # 20 USD, 2024-01-01, "lot"}',
    );
    expect(position.units.toString()).toBe("2 HOOL");
    expect(position.cost?.amount?.toString()).toBe("20 USD");
    expect(position.cost?.date).toEqual(DateTime.fromISO("2024-01-01"));
    expect(position.cost?.label).toBe("lot");
  });

  test("constructs positions from amounts and recognizes total-only costs", () => {
    expect(
      Position.fromAmounts(new Amount("1", "HOOL"), new Amount("10", "USD"))
        .cost?.currency,
    ).toBe("USD");
    expect(
      isTotalCostSpec(new CostSpec(new Decimal(0), new Decimal(10), "USD")),
    ).toBe(true);
  });
});
