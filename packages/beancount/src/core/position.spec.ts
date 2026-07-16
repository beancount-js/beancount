import { DateTime } from "luxon";
import { Decimal } from "@beancount-js/parser";
import { describe, expect, test } from "vitest";
import { Amount } from "./amount";
import {
  Cost,
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

  test("preserves resolved costs while transforming positions", () => {
    const cost = new Cost(
      DateTime.fromISO("2024-01-01"),
      new Amount("10", "USD"),
      "opening",
    );
    const position = new Position(new Amount("-2", "HOOL"), cost);

    expect(position.neg()).toEqual(new Position(new Amount("2", "HOOL"), cost));
    expect(position.abs()).toEqual(new Position(new Amount("2", "HOOL"), cost));
    expect(position.mul("3")).toEqual(
      new Position(new Amount("-6", "HOOL"), cost),
    );
    expect(position.isNegativeAtCost).toBe(cost);
    expect(position.currencyPair).toEqual(["HOOL", "USD"]);
    expect(position.copy({ cost: null })).toEqual(
      new Position(new Amount("-2", "HOOL")),
    );
  });

  test("formats resolved and incomplete costs with their optional details", () => {
    const date = DateTime.fromISO("2024-01-01");
    const cost = new Cost(date, new Amount("10", "USD"), "lot");
    const specification = new CostSpec(
      new Decimal(10),
      new Decimal(20),
      "USD",
      date,
      "lot",
      true,
    );

    expect(new Position(new Amount("2", "HOOL"), cost).toString()).toBe(
      "2 HOOL { 10 USD }",
    );
    expect(cost.toString()).toBe('{ 10 USD, 2024-01-01, "lot" }');
    expect(specification.toString()).toBe("{10 # 20 USD}");
    expect(specification.toString(true)).toBe(
      '{10 # 20 USD,2024-01-01,"lot","*"}',
    );
    expect(specification.copy({ label: "replacement", merge: false })).toEqual(
      new CostSpec(
        new Decimal(10),
        new Decimal(20),
        "USD",
        date,
        "replacement",
      ),
    );
  });

  test("uses stable position sort keys and rejects invalid position syntax", () => {
    expect(
      new Position(
        new Amount("2", "USD"),
        new Cost(null, new Amount("3", "EUR")),
      ).sortKey(),
    ).toEqual([0, 3, "EUR", 2]);
    expect(new Position(new Amount("2", "HOOL")).sortKey()).toEqual([
      12,
      0,
      "",
      2,
    ]);

    expect(() => positionFromString("not a position")).toThrow(
      "Invalid string for position",
    );
    expect(() => positionFromString("1 HOOL {unknown}")).toThrow(
      "Invalid cost component: 'unknown'",
    );
  });
});
