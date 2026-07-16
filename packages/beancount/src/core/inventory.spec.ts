import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import { Decimal } from "@beancount-js/parser";
import { Amount } from "./amount";
import { Conversion } from "./conversion";
import { Posting } from "./data";
import {
  CounterInventory,
  Inventory,
  InventoryKey,
  MatchResult,
  SimpleCounterInventory,
} from "./inventory";
import { Cost, CostSpec, Position } from "./position";

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

  test("handles empty, single, uncosted, and zero-average inventory paths", () => {
    const empty = new Inventory();
    expect(empty.empty).toBe(true);
    expect(empty.length).toBe(0);
    expect(empty.toString()).toBe("");
    expect(empty.currencyUnits("USD")).toEqual(new Amount(0, "USD"));
    expect(empty.isReducedBy(new Amount("-1", "USD"))).toBe(false);
    expect(empty.addAmount(null)[1]).toBe(MatchResult.IGNORED);
    expect(empty.addAmount(new Amount(0, "USD"))[1]).toBe(MatchResult.IGNORED);

    const inventory = new Inventory();
    inventory.addPosting(
      new Posting(
        "Assets:Cash",
        new Amount("2", "USD"),
        new CostSpec(new Decimal("5"), null, "EUR"),
      ),
    );
    expect(inventory.getOnlyPosition()?.toString(true)).toBe("2 USD");
    expect(inventory.currencies).toEqual(["USD"]);
    expect(inventory.costCurrencies).toEqual([]);
    expect(inventory.isReducedBy(new Amount("1", "USD"))).toBe(false);
    expect(inventory.isSmall(new Decimal("1"))).toBe(false);
    expect(inventory.isSmall({ USD: new Decimal("2") })).toBe(true);
    expect(inventory.reduce((position) => position.units.neg()).isEmpty()).toBe(
      false,
    );
    expect(new Inventory().addInventory(inventory)).toEqual(inventory);

    const opposingLots = new Inventory(
      new Position(
        new Amount("1", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-01"), new Amount("5", "USD")),
      ),
      new Position(
        new Amount("-1", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-02"), new Amount("6", "USD")),
      ),
    );
    expect(opposingLots.average().isEmpty()).toBe(true);
  });

  test("supports counter-inventory reductions, positions, and transfer forms", () => {
    const simple = new SimpleCounterInventory();
    simple.add(new Amount("2", "USD"));
    simple.add(new Amount("-2", "USD"));
    expect(simple.toRecord()).toEqual({});
    simple.add(new Amount("3", "EUR"));
    expect(simple.neg().toAmounts()).toEqual([new Amount("-3", "EUR")]);
    expect(simple.positions()).toEqual([new Position(new Amount("3", "EUR"))]);
    expect(
      simple
        .reduce((currency, amount) => new Amount(amount.units, currency))
        .toRecord(),
    ).toEqual({ EUR: 3 });

    const counter = new CounterInventory();
    counter.add(new Amount("2", "USD"), new Cost(date, new Amount("1", "EUR")));
    counter.add(
      new Amount("-2", "USD"),
      new Cost(date, new Amount("1", "EUR")),
    );
    expect(counter.size).toBe(0);
    counter.addInventory(simple);
    expect(counter.toAmounts(Conversion.UNITS)).toEqual([
      new Amount("3", "EUR"),
    ]);
    expect(
      counter
        .reduce((key, units) => new Amount(units, key.currency))
        .toRecord(),
    ).toEqual({ EUR: 3 });
  });

  test("averages uncosted and date-less lots while preserving constructor inputs", () => {
    const uncosted = new Inventory([
      new Position(new Amount("2", "USD")),
      new Position(new Amount("1", "EUR")),
    ]);
    expect(uncosted.average().positions).toEqual([
      new Position(new Amount("2", "USD")),
      new Position(new Amount("1", "EUR")),
    ]);

    const dateLessCost = new Cost(null, new Amount("5", "USD"));
    const dateLess = new Inventory(
      new Position(new Amount("2", "HOOL"), dateLessCost),
    );
    expect(dateLess.average().positions).toEqual([
      new Position(
        new Amount("2", "HOOL"),
        new Cost(null, new Amount("5", "USD")),
      ),
    ]);

    const postingInventory = new Inventory();
    postingInventory.addPosting(
      new Posting(
        "Assets:Brokerage",
        new Amount("1", "HOOL"),
        new Cost(date, new Amount("5", "USD")),
      ),
    );
    expect(postingInventory.costCurrencies).toEqual(["USD"]);
    expect(new InventoryKey("USD").copy().hash).toBe("USD");
    expect(new CounterInventory().add(null)).toBeUndefined();
  });

  test("sorts positions through cost and unit tie-breakers", () => {
    const inventory = new Inventory(
      new Position(
        new Amount("1", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-01"), new Amount("3", "USD")),
      ),
      new Position(
        new Amount("2", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-02"), new Amount("5", "USD")),
      ),
      new Position(
        new Amount("3", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-03"), new Amount("5", "EUR")),
      ),
      new Position(
        new Amount("4", "HOOL"),
        new Cost(DateTime.fromISO("2024-01-04"), new Amount("5", "EUR")),
      ),
    );

    expect(inventory.toString(true)).toBe(
      "(1 HOOL { 3 USD, 2024-01-01 }, 3 HOOL { 5 EUR, 2024-01-03 }, 4 HOOL { 5 EUR, 2024-01-04 }, 2 HOOL { 5 USD, 2024-01-02 })",
    );
  });
});
