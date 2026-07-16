import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Decimal } from "@beancount-js/parser";
import { Amount } from "./amount";
import { Conversion } from "./conversion";
import {
  CounterInventory,
  Inventory,
  InventoryKey,
  MatchResult,
  SimpleCounterInventory,
} from "./inventory";
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

  test("removes exact lots at zero and keeps copies independent", () => {
    const cost = new Cost(date, new Amount("5", "USD"));
    const inventory = new Inventory();
    inventory.addAmount(new Amount("1", "HOOL"), cost);
    inventory.addAmount(new Amount("-1", "HOOL"), cost);
    expect(inventory.isEmpty()).toBe(true);

    inventory.addAmount(new Amount("2", "HOOL"), cost);
    const copy = inventory.copy();
    copy.addAmount(new Amount("1", "HOOL"), cost);
    expect(inventory.currencyUnits("HOOL")).toEqual(new Amount("2", "HOOL"));
    expect(copy.currencyUnits("HOOL")).toEqual(new Amount("3", "HOOL"));
  });

  test("aggregates counter inventories by resolved lot and supports arithmetic", () => {
    const cost = new Cost(date, new Amount("5", "USD"));
    const counter = new CounterInventory();
    counter.add(new Amount("2", "HOOL"), cost);
    counter.add(new Amount("-1", "HOOL"), cost);
    counter.add(new Amount("3", "USD"));

    expect(counter.positions()).toEqual([
      new Position(new Amount("1", "HOOL"), cost),
      new Position(new Amount("3", "USD")),
    ]);
    expect(counter.toRecord()).toEqual({ USD: 8 });
    expect(counter.toRecord(Conversion.UNITS)).toEqual({ HOOL: 1, USD: 3 });
    expect(counter.neg().toRecord()).toEqual({ USD: -8 });
    expect(counter.plus(counter).toRecord()).toEqual({ USD: 16 });
  });

  test("preserves inventory grouping, scaling, and small-balance invariants", () => {
    const inventory = new Inventory(
      new Position(new Amount("2", "HOOL")),
      new Position(new Amount("1", "USD")),
    );

    expect(new Inventory().getOnlyPosition()).toBeNull();
    expect(inventory.isReducedBy(new Amount("-1", "HOOL"))).toBe(true);
    expect(inventory.isReducedBy(new Amount("0", "HOOL"))).toBe(false);
    expect(Object.keys(inventory.split())).toEqual(["HOOL", "USD"]);
    expect(inventory.mul(2).toString()).toBe("(2 USD, 4 HOOL)");
    expect(inventory.abs().toString()).toBe("(1 USD, 2 HOOL)");
    expect(inventory.isSmall(new Decimal("2"))).toBe(true);
    expect(
      inventory.isSmall({ HOOL: new Decimal("1"), USD: new Decimal("1") }),
    ).toBe(false);

    const recombined = inventory.copy().addInventory(inventory.neg());
    expect(recombined.isEmpty()).toBe(true);
  });

  test("enforces counter currency keys and ignores unresolved amounts", () => {
    const simple = new SimpleCounterInventory();
    simple.add(new Amount("2", "USD"));
    simple.add(new Amount("-1", "USD"));
    expect(simple.toRecord()).toEqual({ USD: 1 });
    expect(() => simple.add(new Amount("1", null))).toThrow("No currency");
    expect(() => simple.set("USD", new Amount("1", "EUR"))).toThrow(
      "Invalid currency",
    );

    const counter = new CounterInventory();
    expect(() => counter.add(new Amount(null, "USD"))).not.toThrow();
    expect(counter.size).toBe(0);
    counter.add(new Amount("1", "USD"));
    const key = new InventoryKey("USD", new Cost(date, new Amount("5", "EUR")));
    expect(key.copy()).toEqual(key);
    expect(key.hash).toBe("USD { 5 EUR, 2024-01-01 }");
    expect(CounterInventory.defaultMap().get("Assets:Cash")).toBeInstanceOf(
      CounterInventory,
    );
  });
});
