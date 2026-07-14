import { DateTime } from "luxon";
import type { CounterInventory } from "./inventory";
import { BaseQuote, type PriceMap } from "./prices";
import { Amount } from "./amount";
import { Cost, CostSpec } from "./position";

export enum Conversion {
  AT_COST = "AT_COST",
  AT_VALUE = "AT_VALUE",
  UNITS = "UNITS",
}

export const CONVERSIONS: Record<string, Conversion> = {
  AT_COST: Conversion.AT_COST,
  AT_VALUE: Conversion.AT_VALUE,
  UNITS: Conversion.UNITS,
};

export const DEFAULT_CONVERSION: Conversion = Conversion.AT_COST;

export function getConversion(s: string | null): Conversion {
  if (!s) {
    return DEFAULT_CONVERSION;
  }
  return CONVERSIONS[s] ?? DEFAULT_CONVERSION;
}

// Studio's report controls present the conversion mode to users. Keep this
// display helper with the shared conversion model rather than duplicating the
// mapping in individual Svelte components.
export function conversionLabel(
  conversion: Conversion | string | null,
): string {
  switch (getConversion(typeof conversion === "string" ? conversion : null)) {
    case Conversion.AT_COST:
      return "At Cost";
    case Conversion.AT_VALUE:
      return "At Value";
    case Conversion.UNITS:
      return "Units";
  }
}

export interface ConversionContext {
  prices: PriceMap;
  date: DateTime;
}

export function getCost(entry: {
  units: Amount;
  cost?: Cost | CostSpec | null;
}) {
  const cost = entry.cost;
  if (cost instanceof Cost && cost.amount) {
    return cost.amount.mul(entry.units);
  }
  return entry.units;
}

export function costOrValue(
  inventory: CounterInventory,
  conversion: Conversion,
  context: Partial<ConversionContext> = {},
) {
  switch (conversion) {
    case Conversion.AT_COST:
      return inventory.reduce((key, value) => {
        const cost = key.cost?.amount;
        if (cost) {
          return cost.mul(value);
        }
        return new Amount(value, key.currency);
      });
    case Conversion.UNITS:
      return inventory.reduce((key, value) => {
        return new Amount(value, key.currency);
      });
    case Conversion.AT_VALUE:
      return inventory.reduce((key, value) => {
        const cost = key.cost?.amount;
        if (!cost) {
          return new Amount(value, key.currency);
        }
        const quote = new BaseQuote(key.currency, cost.currency);
        const price = context.prices?.getPrice(quote, context.date);
        if (price) {
          return new Amount(price.mul(value), cost.currency);
        }
        return cost.mul(value.toString());
      });
  }
}
