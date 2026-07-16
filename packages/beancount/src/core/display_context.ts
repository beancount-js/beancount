import { Decimal } from "@beancount-js/parser";
import { Distribution } from "./distribution";

export enum Precision {
  MOST_COMMON = "MOST_COMMON",
  MAXIMUM = "MAXIMUM",
}

export enum Align {
  NATURAL = "NATURAL",
  DOT = "DOT",
  RIGHT = "RIGHT",
}

class CurrencyContext {
  readonly fractional = new Distribution();
  integerMax = 1;
  fixed: number | null = null;

  update(number: Decimal) {
    const [integer] = number.value.replace("-", "").split(".");
    this.integerMax = Math.max(this.integerMax, integer.length);
    if (this.fixed === null) this.fractional.update(number.precision);
  }

  precision(kind: Precision) {
    if (this.fixed !== null) return this.fixed;
    return kind === Precision.MOST_COMMON
      ? this.fractional.mode()
      : this.fractional.max();
  }
}

function withCommas(value: string) {
  const [integer, fractional] = value.split(".");
  const sign = integer.startsWith("-") ? "-" : "";
  const digits = sign ? integer.slice(1) : integer;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + grouped + (fractional === undefined ? "" : `.${fractional}`);
}

export class DisplayFormatter {
  constructor(
    readonly context: DisplayContext,
    readonly alignment: Align,
    readonly precision: Precision,
    readonly commas: boolean,
    readonly reserved: number,
  ) {}

  format(number: Decimal, currency = "__default__") {
    const fraction = this.context.fraction(currency, this.precision);
    let rendered = fraction === null ? number.value : number.toFixed(fraction)!;
    if (this.commas) rendered = withCommas(rendered);
    if (this.alignment === Align.NATURAL) return rendered;
    const width = this.context.width(
      this.precision,
      this.commas,
      this.reserved,
    );
    if (this.alignment === Align.RIGHT) return rendered.padStart(width, " ");
    const dot = rendered.indexOf(".");
    const integerWidth = this.context.integerWidth(this.commas);
    const left = dot === -1 ? rendered : rendered.slice(0, dot);
    const right = dot === -1 ? "" : rendered.slice(dot + 1);
    const targetFraction = this.context.maxFraction(this.precision) ?? 8;
    return `${left.padStart(integerWidth, " ")}${targetFraction ? `.${right.padEnd(targetFraction, " ")}` : ""}`.padEnd(
      width,
      " ",
    );
  }

  quantize(number: Decimal, currency = "__default__") {
    return this.context.quantize(number, currency, this.precision);
  }
}

/** Collects per-currency display precision and builds deterministic formatters. */
export class DisplayContext {
  readonly currencies = new Map<string, CurrencyContext>();
  commas = false;

  constructor() {
    this.currencies.set("__default__", new CurrencyContext());
  }

  private currency(currency: string) {
    const existing = this.currencies.get(currency);
    if (existing) return existing;
    const context = new CurrencyContext();
    this.currencies.set(currency, context);
    return context;
  }

  update(number: Decimal, currency = "__default__") {
    this.currency(currency).update(number);
  }
  setCommas(commas: boolean) {
    this.commas = commas;
  }
  setFixedPrecision(currency: string, digits: number) {
    const context = this.currency(currency);
    context.fixed = digits;
  }
  fraction(currency: string, precision: Precision) {
    return (
      this.currencies.get(currency) ?? this.currency("__default__")
    ).precision(precision);
  }
  maxFraction(precision: Precision) {
    return Math.max(
      ...[...this.currencies.values()].map(
        (context) => context.precision(precision) ?? 0,
      ),
    );
  }
  integerWidth(commas: boolean) {
    const digits = Math.max(
      ...[...this.currencies.values()].map((context) => context.integerMax),
    );
    return digits + 1 + (commas ? Math.floor((digits - 1) / 3) : 0);
  }
  width(precision: Precision, commas: boolean, reserved: number) {
    const fraction = this.maxFraction(precision) ?? 0;
    return this.integerWidth(commas) + reserved + (fraction ? fraction + 1 : 0);
  }

  quantize(
    number: Decimal,
    currency: string,
    precision = Precision.MOST_COMMON,
  ) {
    const fraction = this.fraction(currency, precision);
    return fraction === null ? number : new Decimal(number.toFixed(fraction)!);
  }

  build(
    alignment = Align.NATURAL,
    precision = Precision.MOST_COMMON,
    commas = this.commas,
    reserved = 0,
  ) {
    return new DisplayFormatter(this, alignment, precision, commas, reserved);
  }
}

export const DEFAULT_DISPLAY_CONTEXT = new DisplayContext();
export const DEFAULT_FORMATTER = DEFAULT_DISPLAY_CONTEXT.build();
