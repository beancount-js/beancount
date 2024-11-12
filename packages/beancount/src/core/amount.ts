import {
  Currency,
  Decimal,
  NumberSource,
  RoundingMode,
} from "@beancount-js/parser";
import { isMissing, MISSING, MissingType, resolveMissing } from "./data";

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
  readonly units: Decimal | MissingType;
  readonly currency: string | MissingType;
  readonly source: string;

  constructor(
    source: NumberSource | Amount | MissingType = MISSING,
    currency: Currency | MissingType = MISSING,
  ) {
    if (source instanceof Amount) {
      this.source = source.source;
      this.units = source.units;
      this.currency = currency ?? source.currency;
    } else {
      this.source = source?.toString() ?? "";
      this.units = isMissing(source) ? source : new Decimal(source);
      this.currency = currency ?? MISSING;
    }
  }

  copy(
    props: Partial<{
      units: NumberSource | Amount | MissingType;
      currency: Currency | MissingType;
    }>,
  ) {
    return new Amount(
      props.units ?? this.units,
      props.currency ?? this.currency,
    );
  }

  with(units: NumberSource) {
    return this.copy({ units });
  }

  digits(): Array<number> {
    if (isMissing(this.units)) return [];
    return this.units.digits();
  }

  toFixed(dp?: number, roundingMode?: RoundingMode) {
    return this.with(this.value.toFixed(dp, roundingMode));
  }

  get zero() {
    if (isMissing(this.units)) {
      throw new Error("Missing units on number");
    }
    return this.units.zero;
  }

  get valueOf() {
    if (isMissing(this.units)) {
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

  get value(): Decimal {
    if (isMissing(this.units)) {
      throw new Error("Missing units on number");
    }
    return this.units;
  }

  public quantize(value: NumberSource | Amount): Amount {
    if (value instanceof Amount) {
      return this.quantize(value.value);
    }
    return this.with(this.value.quantize(value));
  }

  public eq(amount: NumberSource | Amount) {
    if (amount instanceof Amount) {
      return isMissing(this.units)
        ? isMissing(amount.units) && this.currency === amount.currency
        : this.units.eq(resolveMissing(amount.units)) &&
            this.currency === amount.currency;
    }
    return isMissing(this.units) ? isMissing(amount) : this.units.eq(amount);
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
    return this.with(this.value.scaleb(exponent));
  }

  public toString(numeric: boolean = false) {
    if (this.source) {
      return (this.source + " " + this.currency).trim();
    }
    return `${this.units} ${this.currency}`.trim();
  }
}
