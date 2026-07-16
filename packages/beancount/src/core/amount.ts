import { Decimal } from "@beancount-js/parser";
import type {
  Currency,
  NumberSource,
  RoundingMode,
} from "@beancount-js/parser";
import type { Typing } from "./data";

export function sameSign(a: NumberSource, b: NumberSource) {
  const na = new Decimal(a);
  const nb = new Decimal(b);
  return na.gte(0) === nb.gte(0);
}

/**
 * An 'Amount' represents a number of a particular unit of something.
 *
 * It's essentially a typed number, with corresponding manipulation operations
 * defined on it.
 */
export class Amount {
  private num: Decimal | null;
  readonly currency: string | null;

  constructor(
    source: NumberSource | Amount = null,
    currency: Currency | null = null,
    precision?: number,
  ) {
    if (source instanceof Amount) {
      this.num = source.num;
      this.currency = currency ?? source.currency;
    } else {
      this.num =
        source != null && source != undefined
          ? new Decimal(source, precision)
          : null;
      this.currency = currency;
    }
  }

  static typings(): Record<string, Typing> {
    return {
      units: Decimal,
      currency: String,
    };
  }

  isDefined() {
    if (!this.num) {
      return false;
    }
    return true;
  }

  get units(): Decimal {
    if (!this.num) {
      throw new Error("Missing units on number");
    }
    return this.num;
  }

  copy(
    props: Partial<{
      units: NumberSource | Amount;
      currency: Currency | null;
    }>,
  ) {
    if (props.units === undefined) {
      return new Amount(this, props.currency ?? this.currency);
    }
    return new Amount(
      props.units,
      props.currency ?? this.currency,
      this.num?.precision,
    );
  }

  with(units: NumberSource) {
    return this.copy({ units });
  }

  digits(): Array<number> {
    return this.units?.digits() ?? [];
  }

  toFixed(dp?: number, roundingMode?: RoundingMode) {
    return this.with(this.value.toFixed(dp, roundingMode));
  }

  get zero() {
    if (!this.units) {
      throw new Error("Missing units on number");
    }
    return this.units.zero;
  }

  get valueOf() {
    if (!this.units) {
      return undefined;
    }
    return this.value.valueOf();
  }

  get exponent() {
    return this.value.exponent;
  }

  get number() {
    return this.value.number;
  }

  get precision() {
    return this.value.precision;
  }

  get value(): Decimal {
    if (!this.units) {
      throw new Error("Missing units on number");
    }
    return this.units;
  }

  public quantize(value: NumberSource | Amount): Amount {
    if (value instanceof Amount) {
      return this.quantize(value.value);
    }
    return new Amount(this.value.quantize(value), this.currency);
  }

  public eq(amount: NumberSource | Amount) {
    if (amount instanceof Amount) {
      return (
        this.currency === amount.currency &&
        (this.units ? this.units.eq(amount.units) : this.units === amount)
      );
    }
    return this.units ? this.units.eq(amount) : this.units === amount;
  }

  public add(amount: NumberSource | Amount): Amount {
    return this.plus(amount);
  }

  public plus(amount: NumberSource | Amount): Amount {
    if (amount instanceof Amount) {
      return this.plus(amount.value);
    }
    return this.with(this.value.plus(amount));
  }

  public sub(amount: NumberSource | Amount): Amount {
    return this.minus(amount);
  }

  public minus(amount: NumberSource | Amount): Amount {
    if (amount instanceof Amount) {
      return this.minus(amount.value);
    }
    return this.with(this.value.minus(amount));
  }

  public mul(amount: NumberSource | Amount): Amount {
    if (amount instanceof Amount) {
      return this.mul(amount.value);
    }
    return this.with(this.value.mul(amount));
  }

  public div(amount: NumberSource | Amount): Amount {
    if (amount instanceof Amount) {
      return this.div(amount.value);
    }
    return this.with(this.value.div(amount));
  }

  public lt(amount: NumberSource | Amount): boolean {
    if (amount instanceof Amount) {
      return this.lt(amount.value);
    }
    return this.value.lt(amount);
  }

  public lte(amount: NumberSource | Amount): boolean {
    if (amount instanceof Amount) {
      return this.lte(amount.value);
    }
    return this.value.lte(amount);
  }

  public gt(amount: NumberSource | Amount): boolean {
    if (amount instanceof Amount) {
      return this.gt(amount.value);
    }
    return this.value.gt(amount);
  }

  public gte(amount: NumberSource | Amount): boolean {
    if (amount instanceof Amount) {
      return this.gte(amount.value);
    }
    return this.value.gte(amount);
  }

  public neg(): Amount {
    return this.with(this.value.neg());
  }

  public abs(): Amount {
    return this.with(this.value.abs());
  }

  public scaleb(exponent: number): Amount {
    return new Amount(this.value.scaleb(exponent), this.currency);
  }

  public toString(_numeric: boolean = false) {
    if (!this.isDefined()) {
      return "";
    }
    return `${this.units} ${this.currency}`.trim();
  }
}
