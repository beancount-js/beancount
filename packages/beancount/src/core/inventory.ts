import { Amount } from "./amount";
import { type Currency, Posting } from "./data";
import { sameSign } from "./amount";
import { Cost, CostSpec, Position } from "./position";
import { Decimal } from "@beancount-js/parser";
import { DefaultKeyedMap, DefaultMap } from "./map";
import { Conversion, ConversionContext, costOrValue } from "./conversion";

export enum MatchResult {
  // A new lot was created.
  CREATED = 1,
  // An existing lot was reduced.
  REDUCED = 2,
  //  An existing lot was augmented.
  AUGMENTED = 3,
  // No change was applied.
  IGNORED = 4,
}

export class Inventory {
  #values: Record<string, Position> = {};
  constructor() {}

  get empty() {
    return this.length == 0;
  }

  get length() {
    return Object.keys(this.#values).length;
  }

  isReducedBy(amount: Amount) {
    if (amount.zero) {
      return false;
    }
    for (const [_, pos] of Object.entries(this.#values)) {
      const units = pos.units;
      if (
        amount.currency === units.currency &&
        !sameSign(units.number, amount.number)
      ) {
        return true;
      }
    }
    return false;
  }

  copy() {
    const inventory = new Inventory();
    Object.keys(this.#values).forEach((k) => {
      inventory.#values[k] = this.#values[k].copy();
    });
    return inventory;
  }

  get positions(): Array<Position> {
    return Object.keys(this.#values).map((k) => this.#values[k]);
  }

  public toString(showDetails: boolean = false) {
    return this.positions.map((it) => it.toString(showDetails)).join(", ");
  }

  get currencies(): Array<Currency> {
    return [
      ...new Set(
        this.positions.map((it) => it.units?.currency || "").filter((it) => it),
      ),
    ];
  }

  get costCurrencies(): Array<Currency> {
    return [
      ...new Set(
        this.positions
          .map((it) => it.cost?.amount?.currency?.toString() || "")
          .filter((it) => it),
      ),
    ];
  }

  currencyUnits(currency: Currency | null): Amount {
    return this.positions
      .filter((it) => it.units.currency === currency)
      .reduce(
        (acc, cur) => {
          return acc.add(cur.units);
        },
        new Amount(0, currency),
      );
  }

  split(): Record<Currency, Inventory> {
    const perCurrencyRecord: Record<string, Inventory> = {};
    this.currencies.forEach((it) => (perCurrencyRecord[it] = new Inventory()));
    this.positions.forEach((it) =>
      perCurrencyRecord[it.units?.currency?.toString() || ""].addPosition(it),
    );
    return perCurrencyRecord;
  }

  mul(scalar: number | string | Amount) {
    const inventory = new Inventory();
    this.positions.forEach((pos) => {
      inventory.addPosition(pos.mul(scalar));
    });
    return inventory;
  }

  abs() {
    const inventory = new Inventory();
    this.positions.forEach((pos) => {
      inventory.addPosition(pos.abs());
    });
    return inventory;
  }

  neg() {
    const inventory = new Inventory();
    this.positions.forEach((pos) => {
      inventory.addPosition(pos.neg());
    });
    return inventory;
  }

  /**
   * Return true if all the positions in the inventory are small.
   *
   * @param tolerances A Decimal, the small number of units under which a
   *   position is considered small, or a dict of currency to such epsilon
   *   precision.
   * @returns A boolean
   */
  isSmall(tolerance: Record<string, Decimal> | Decimal): boolean {
    const positions = this.positions;

    if (tolerance instanceof Decimal) {
      return !positions.some((it) => it.units.abs().gt(tolerance));
    } else {
      for (let i = 0; i < positions.length; i++) {
        const position = positions[i];
        const value = tolerance[position.units.currency?.toString() || ""] || 0;
        if (position.units.abs().gt(value)) {
          return false;
        }
      }
      return true;
    }
  }

  /**
   * Add to this inventory using amount and cost. This adds with strict lot
   * matching, that is, no partial matches are done on the arguments to the keys
   * of the inventory.
   *
   * @param units An Amount instance to add.
   * @param cost An instance of Cost or None, as a key to the inventory.
   * @returns A pair of (position, matched) where 'position' is the position
   *   that that was modified BEFORE it was modified, and where 'matched' is a
   *   MatchResult enum that hints at how the lot was booked to this inventory.
   *   Position may be None if there is no corresponding Position object, e.g.
   *   the position was deleted.
   */
  public addAmount(
    units: Amount | null,
    cost: Cost | null = null,
  ): [Position | null, MatchResult] {
    const key =
      `${units?.currency?.toString() || ""} ${cost?.toString(true) || ""}`.trim();
    const pos = this.#values[key];

    if (!units) {
      return [pos, MatchResult.IGNORED];
    }
    let booking: MatchResult;

    if (pos) {
      booking = sameSign(pos.units.number, units.number)
        ? MatchResult.AUGMENTED
        : MatchResult.REDUCED;
      const number = pos.units.add(units);
      if (number.zero) {
        delete this.#values[key];
      } else {
        this.#values[key] = new Position(number, cost);
      }
    } else if (units.zero) {
      booking = MatchResult.IGNORED;
    } else {
      booking = MatchResult.CREATED;
      this.#values[key] = new Position(units, cost);
    }
    return [pos, booking];
  }

  /**
   * Add using a position (with strict lot matching). Return True if this
   * position was booked against and reduced another.
   *
   * @param position The Posting or Position to add to this inventory.
   * @returns A pair of (position, booking) where 'position' is the position
   *   that that was modified, and where 'matched' is a MatchResult enum that
   *   hints at how the lot was booked to this inventory.
   */
  public addPosition(position: Position): [Position | null, MatchResult] {
    return this.addAmount(position.units, position.cost);
  }

  public addPosting(posting: Posting) {
    return this.addAmount(
      posting.units,
      posting.cost instanceof Cost ? posting.cost : null,
    );
  }

  public addInventory(inventory: Inventory) {
    if (this.empty) {
      Object.keys(inventory.#values).forEach((key) => {
        this.#values[key] = inventory.#values[key];
      });
      return this;
    } else {
      inventory.positions.forEach((p) => this.addPosition(p));
      return this;
    }
  }
}

export class SimpleCounterInventory extends DefaultMap<string, Amount> {
  constructor(entries?: readonly (readonly [string, Amount])[] | null) {
    super((currency: string) => new Amount("0", currency), entries);
  }

  toRecord(): Record<string, number> {
    const data: Record<string, number> = {};
    for (const [k, value] of this.entries()) {
      if (value?.units) {
        data[k] = value.units.number;
      }
    }
    return data;
  }

  add(number: Amount | null) {
    if (!number || !number.currency) {
      throw new Error(`No currency specified for amount: ${number}`);
    }
    this.set(number.currency, number);
  }

  set(key: string, value: Amount) {
    if (value.currency !== key) {
      throw new Error(
        `Invalid currency for amount expected ${key} found ${value.currency}`,
      );
    }
    this.insert(key);
    const amount = super.get(key).add(value);
    if (amount.zero) {
      this.delete(key);
      return this;
    } else {
      return super.set(key, amount);
    }
  }

  neg() {
    const entries: Array<[string, Amount]> = [];
    for (const [key, value] of this.entries()) {
      entries.push([key, value.neg()]);
    }
    return new SimpleCounterInventory(entries);
  }

  reduce(reducer: (key: string, value: Amount) => Amount) {
    const counter = new SimpleCounterInventory();
    for (const [key, value] of this.entries()) {
      const amount = reducer(key, value);
      counter.add(amount);
    }
    return counter;
  }

  positions() {
    return [...this.values()].map((it) => new Position(it));
  }
}

export class InventoryKey {
  constructor(
    readonly currency: string,
    readonly cost: Cost | null = null,
  ) {}

  copy() {
    return new InventoryKey(this.currency, this.cost?.copy());
  }

  get hash() {
    return `${this.currency} ${this.cost?.toString(true) || ""}`.trim();
  }
}

export class CounterInventory extends DefaultKeyedMap<InventoryKey, Decimal> {
  constructor(entries?: readonly (readonly [InventoryKey, Decimal])[] | null) {
    super(() => new Decimal("0"), entries);
  }

  add(amount: Amount | null, cost?: Cost | CostSpec) {
    if (!amount?.currency || amount.units === null) {
      return;
    }
    const costed = cost instanceof Cost ? cost : null;
    this.set(new InventoryKey(amount.currency, costed), amount.units);
  }

  set(key: InventoryKey, value: Decimal) {
    this.insert(key);
    const amount = super.get(key).add(value);
    if (amount.zero) {
      this.delete(key);
      return this;
    } else {
      return super.set(key, amount);
    }
  }

  neg() {
    const entries: Array<[InventoryKey, Decimal]> = [];
    for (const [key, value] of this.entries()) {
      entries.push([key, value.neg()]);
    }
    return new CounterInventory(entries);
  }

  copy() {
    const entries: Array<[InventoryKey, Decimal]> = [];
    for (const [key, value] of this.entries()) {
      entries.push([key.copy(), value.copy()]);
    }
    return new CounterInventory(entries);
  }

  plus(inventory: CounterInventory) {
    const counter = this.copy();
    counter.addInventory(inventory);
    return counter;
  }

  reduce(reducer: (key: InventoryKey, value: Decimal) => Amount) {
    const counter = new SimpleCounterInventory();
    for (const [key, value] of this.entries()) {
      const amount = reducer(key, value);
      counter.add(amount);
    }
    return counter;
  }

  positions() {
    const values: Array<Position> = [];
    for (const [key, value] of this.entries()) {
      values.push(new Position(new Amount(value, key.currency), key.cost));
    }
    return values;
  }

  convert(conversion: Conversion, context: Partial<ConversionContext> = {}) {
    return costOrValue(this, conversion, context);
  }

  toRecord(
    conversion: Conversion = Conversion.AT_COST,
    context: Partial<ConversionContext> = {},
  ): Record<string, number> {
    return this.convert(conversion, context).toRecord();
  }

  public addInventory(inventory: CounterInventory | SimpleCounterInventory) {
    if (inventory instanceof CounterInventory) {
      for (const [key, value] of inventory.entries()) {
        this.set(key, value);
      }
    } else {
      for (const [key, value] of inventory.entries()) {
        this.set(new InventoryKey(key), value.units);
      }
    }
  }

  static defaultMap(): DefaultMap<string, CounterInventory> {
    return new DefaultMap<string, CounterInventory>(
      () => new CounterInventory(),
    );
  }
}
