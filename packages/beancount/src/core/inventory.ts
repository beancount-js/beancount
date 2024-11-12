import { Amount } from "./amount";
import {
  type Currency,
  isMissing,
  MISSING,
  type MissingType,
  Posting,
  resolveMissing,
} from "./data";
import { sameSign } from "./amount";
import { Cost, Position } from "./position";
import { Decimal } from "@beancount-js/parser";

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
        this.positions
          .map((it) => resolveMissing(it.units)?.currency?.toString() || "")
          .filter((it) => it),
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

  currencyUnits(currency: Currency | MissingType): Amount {
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
    units: Amount | MissingType,
    cost: Cost | MissingType = MISSING,
  ): [Position | null, MatchResult] {
    const key =
      `${units?.currency?.toString() || ""} ${cost?.toString(true) || ""}`.trim();
    const pos = this.#values[key];

    if (isMissing(units) || !units) {
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
      posting.cost instanceof Cost ? posting.cost : MISSING,
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
