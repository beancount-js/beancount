import { Amount } from "./amount";
import { Posting } from "./data";
import { Cost, Position } from "./position";
import type { PriceMap } from "./prices";

type ConvertiblePosition = Posting | Position;

/** Return the units amount carried by a position or posting. */
export function getUnits(position: Position): Amount;
export function getUnits(position: Posting): Amount | null;
export function getUnits(position: ConvertiblePosition): Amount | null;
export function getUnits(position: ConvertiblePosition): Amount | null {
  return position.units;
}

/** Return the total cost basis when a resolved cost is available. */
export function getCost(position: Position): Amount;
export function getCost(position: Posting): Amount | null;
export function getCost(position: ConvertiblePosition): Amount | null;
export function getCost(position: ConvertiblePosition): Amount | null {
  const units = getUnits(position);
  const cost = position.cost;
  if (units && cost instanceof Cost && cost.amount) {
    return cost.amount.mul(units.number);
  }
  return units;
}

export function getWeight(position: ConvertiblePosition): Amount {
  const units = getUnits(position);
  if (!units) return new Amount("0");

  const costWeight = getCost(position);
  if (position.cost instanceof Cost && costWeight) return costWeight;

  if (position instanceof Posting && position.price) {
    return position.price.mul(units.number);
  }
  return units;
}

type UsedPrice = [date: import("luxon").DateTime | null, rate?: unknown];

/**
 * Return a position's market value in its cost or posting-price currency.
 * If no corresponding rate is available, retain the units unchanged.
 */
export function getValue(
  position: ConvertiblePosition,
  priceMap: PriceMap,
  date?: import("luxon").DateTime,
  outputDatePrices?: UsedPrice[],
): Amount | null {
  const units = getUnits(position);
  if (!units) return units;

  const valueCurrency =
    (position.cost instanceof Cost && position.cost.amount?.currency) ||
    (position instanceof Posting && position.price?.currency) ||
    null;
  if (!valueCurrency) return units;

  const point = priceMap.pricePoint(
    [units.currency ?? "", valueCurrency],
    date,
  );
  if (outputDatePrices) {
    outputDatePrices.push([point?.date ?? null, point?.units]);
  }
  return point
    ? new Amount(units.value.mul(point.units), valueCurrency)
    : units;
}

/** Convert an amount to a target currency, optionally attempting one-hop rates. */
export function convertAmount(
  amount: Amount,
  targetCurrency: string,
  priceMap: PriceMap,
  date?: import("luxon").DateTime,
  via: readonly (string | null | undefined)[] = [],
): Amount {
  const directRate = priceMap.getPrice(
    [amount.currency ?? "", targetCurrency],
    date,
  );
  if (directRate) {
    return new Amount(amount.value.mul(directRate), targetCurrency);
  }

  for (const intermediate of via) {
    if (!intermediate || intermediate === targetCurrency) continue;
    const firstRate = priceMap.getPrice(
      [amount.currency ?? "", intermediate],
      date,
    );
    const secondRate = priceMap.getPrice([intermediate, targetCurrency], date);
    if (firstRate && secondRate) {
      return new Amount(
        amount.value.mul(firstRate).mul(secondRate),
        targetCurrency,
      );
    }
  }
  return amount;
}

/** Convert a position to a target currency, falling back through cost or price. */
export function convertPosition(
  position: ConvertiblePosition,
  targetCurrency: string,
  priceMap: PriceMap,
  date?: import("luxon").DateTime,
): Amount | null {
  const units = getUnits(position);
  if (!units) return units;

  const via =
    (position.cost instanceof Cost && position.cost.amount?.currency) ||
    (position instanceof Posting && position.price?.currency) ||
    null;
  return convertAmount(units, targetCurrency, priceMap, date, [via]);
}
