import { Decimal, formatDate, writeString } from "@beancount-js/parser";
import { Amount } from "./amount";
import { DateTime } from "luxon";
import type { Typing } from "./data";

/** A variant of Amount that also includes a date and a label. */
export class Cost {
  /**
   * @param date A date for the date that the lot was created at. There should
   *   always be a valid date.
   * @param amount A Decimal, the per-unit cost for the currency
   * @param label A string for the label of this lot, or None, if there is no
   *   label.
   */
  constructor(
    readonly date: DateTime | null = null,
    readonly amount: Amount | null = null,
    readonly label: string = "",
  ) {}

  get currency() {
    return this.amount?.currency || "";
  }

  static typings(): Record<string, Typing> {
    return {
      date: DateTime,
      amount: Amount,
      label: String,
    };
  }

  public toString(showDetails: boolean = true) {
    const str: Array<string> = [this.amount?.toString() || ""];
    if (showDetails) {
      str.push(formatDate(this.date));
      if (this.label) {
        str.push(writeString(this.label));
      }
    }
    return "{ " + str.filter((it) => it).join(", ") + " }";
  }

  public copy(
    data: Partial<{
      date: DateTime;
      amount: Amount | null;
      label: string;
    }> = {},
  ) {
    return new Cost(
      data.date || this.date,
      data.amount || this.amount,
      data.label === undefined ? this.label : data.label,
    );
  }
}

/**
 * A stand-in for an "incomplete" Cost, that is, a container all the data that
 * was provided by the user in the input in order to resolve this lot to a
 * particular lot and produce an instance of Cost. Any of the fields of this
 * object may be left unspecified, in which case they take the special value
 * "NA" (see below), if the field was absent from the input.
 */
export class CostSpec {
  /**
   * @param numberPer A Decimal instance, the cost/price per unit, or None if
   *   unspecified.
   * @param numberTotal A Decimal instance, the total cost/price, or None if
   *   unspecified.
   * @param currency A string, the commodity of the amount, or None if
   *   unspecified.
   * @param date A datetime.date, or None if unspecified.
   * @param label A string for the label of this lot, or None if unspecified.
   * @param merge A boolean, true if this specification calls for averaging the
   *   units of this lot's currency, or False if unspecified.
   */
  constructor(
    readonly numberPer: Decimal | null = null,
    readonly numberTotal: Decimal | null = null,
    readonly currency: string | null = null,
    readonly date: DateTime | null = null,
    readonly label: string = "",
    readonly merge: boolean = false,
  ) {}

  public copy(
    data: Partial<{
      numberPer: Decimal | null;
      numberTotal: Decimal | null;
      currency: string | null;
      date: DateTime | null;
      label: string;
      merge: boolean;
    }> = {},
  ) {
    return new CostSpec(
      data.numberPer === undefined ? this.numberPer : data.numberPer,
      data.numberTotal === undefined ? this.numberTotal : data.numberTotal,
      data.currency === undefined ? this.currency : data.currency,
      data.date === undefined ? this.date : data.date,
      data.label === undefined ? this.label : data.label,
      data.merge === undefined ? this.merge : data.merge,
    );
  }

  public toString(showDetails: boolean = false) {
    const str: Array<string> = [];
    const amountList: Array<string> = [];
    const date = this.date;
    if (this.numberPer != null) amountList.push(this.numberPer.toString());
    if (this.numberTotal != null) {
      amountList.push("#");
      amountList.push(this.numberTotal.toString());
    }
    if (this.currency) amountList.push(this.currency.toString());
    str.push(amountList.join(" "));

    if (showDetails) {
      if (date) {
        str.push(formatDate(date));
      }
      if (this.label) {
        str.push(writeString(this.label));
      }
      if (this.merge) {
        str.push(writeString("*"));
      }
    }
    return "{" + str.join(",") + "}";
  }
}
const CURRENCY_ORDER: Record<string, number> = {
  USD: 0,
  EUR: 1,
  JPY: 2,
  CAD: 3,
  GBP: 4,
  AUD: 5,
  NZD: 6,
  CHF: 7,
  // All the rest in alphabetical order...
};

const NCURRENCIES = Object.keys(CURRENCY_ORDER).length;

export function currencySortKey(currency: string) {
  return CURRENCY_ORDER[currency] ?? NCURRENCIES + currency.length;
}

/**
 * A 'Position' is a pair of units and optional cost. This is used to track
 * inventories.
 */
export class Position {
  /**
   * @param units An Amount, the number of units and its currency.
   * @param cost A Cost that represents the lot, or None.
   */
  constructor(
    readonly units: Amount,
    readonly cost: Cost | null = null,
  ) {}

  static typings(): Record<string, Typing> {
    return {
      units: Amount,
      cost: Cost,
    };
  }

  copy(
    data: Partial<{
      units: Amount;
      cost: Cost | null;
    }> = {},
  ) {
    return new Position(
      data.units || this.units,
      data.cost === undefined ? this.cost : data.cost,
    );
  }

  public sortKey() {
    const currency = this.units.currency?.toString() || "";
    const orderUnits = currencySortKey(currency);
    const amount = this.cost?.amount;
    const costNumber = amount ? amount.number : 0;
    const costCurrency = amount ? amount.currency : "";
    return [orderUnits, costNumber, costCurrency, this.units.number];
  }

  public neg() {
    return new Position(this.units.neg(), this.cost);
  }

  public abs() {
    return new Position(this.units.abs(), this.cost);
  }

  public mul(value: Amount | string | number) {
    return new Position(this.units.mul(value), this.cost);
  }

  public toString(showDetails: boolean = false) {
    return `${this.units.toString()} ${
      this.cost?.toString(showDetails) || ""
    }`.trim();
  }

  get isNegativeAtCost() {
    return this.units.lt(0) && this.cost;
  }

  get currencyPair() {
    const pairs = [this.units.currency];
    const amount = this.cost?.amount;
    if (amount) {
      pairs.push(amount.currency);
    }
    return pairs;
  }
}
