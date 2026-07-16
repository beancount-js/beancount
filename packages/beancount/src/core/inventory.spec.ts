import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Amount } from "./amount";
import { Inventory, MatchResult } from "./inventory";
import { Cost, Position } from "./position";

const date = DateTime.fromISO("2024-01-01");

describe("Inventory", () => {
  test("tracks lot aggregation, reductions, and mixed units", () => {
    const inventory = new Inventory();
    const cost = new Cost(date, new Amount("5", "USD"));

    expect(inventory.addAmount(new Amount("2", "HOOL"), cost)[1]).toBe(
      MatchResult.CREATED,
    );
    expect(inventory.addAmount(new Amount("3", "HOOL"), cost)[1]).toBe(
      MatchResult.AUGMENTED,
    );
    expect(inventory.currencyUnits("HOOL")).toEqual(new Amount("5", "HOOL"));
    expect(inventory.addAmount(new Amount("-1", "HOOL"), cost)[1]).toBe(
      MatchResult.REDUCED,
    );
    expect(inventory.isMixed()).toBe(false);

    inventory.addAmount(new Amount("-1", "HOOL"));
    expect(inventory.isMixed()).toBe(true);
  });

  test("exposes deterministic grouping and single-position behavior", () => {
    const inventory = new Inventory(
      new Position(new Amount("2", "EUR")),
      new Position(new Amount("1", "USD")),
    );

    expect(inventory.toString()).toBe("(1 USD, 2 EUR)");
    expect(() => inventory.getOnlyPosition()).toThrow("more than one");
    expect(inventory.segregateUnits(["USD"]).get("USD")?.length).toBe(1);
    expect(inventory.segregateUnits(["USD"]).get(null)?.length).toBe(1);
    expect(inventory.currencyPairs()).toEqual(
      new Set([
        ["EUR", null],
        ["USD", null],
      ]),
    );
  });

  test("averages costed lots by unit and cost currency", () => {
    const inventory = new Inventory(
      new Position(
        new Amount("2", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-02"), new Amount("5", "USD")),
      ),
      new Position(
        new Amount("3", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-01"), new Amount("7", "USD")),
      ),
    );

    expect(inventory.average().positions).toEqual([
      new Position(
        new Amount("5", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-01"), new Amount("6.2", "USD")),
      ),
    ]);
  });
});
