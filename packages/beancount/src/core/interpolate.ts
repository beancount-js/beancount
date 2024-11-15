import { getWeight } from "./convert";
import { Posting } from "./data";
import { Inventory } from "./inventory";
import { Cost } from "./position";
import { Amount } from "./amount";
import { Decimal } from "@beancount-js/parser";
import { BeancountOptions } from "./options";

export const MAXIMUM_TOLERANCE = new Decimal(0.5);
export const MAX_TOLERANCE_DIGITS = 5;

// Meta-data field appended to automatically inserted postings.
// (Note: A better name might have been '__interpolated__'.)
export const AUTOMATIC_META = "__automatic__";

// Meta-data field appended to postings inserted to absorb rounding error.
export const AUTOMATIC_RESIDUAL = "__residual__";

// Meta-data field added for the tolerances inferred for this entry.
export const AUTOMATIC_TOLERANCES = "__tolerances__";

/**
 * Return True if a Posting has a balance amount that would have to be
 * calculated.
 *
 * @param posting A Posting instance.
 * @returns A boolean
 */
export function hasNonTrivialBalance(posting: Posting): boolean {
  if (posting.cost || posting.price) {
    return true;
  }
  return false;
}

/**
 * Compute the residual of a set of complete postings, and the per-currency
 * precision.
 *
 * This is used to cross-check a balanced transaction.
 *
 * The precision is the maximum fraction that is being used for each currency (a
 * dict). We use the currency of the weight amount in order to infer the
 * quantization precision for each currency. Integer amounts aren't contributing
 * to the determination of precision.
 *
 * @param postings A list of Posting instances
 * @returns An instance of Inventory, with the residual of the given list of
 *   postings.
 */
export function computeResidual(postings: ArrayLike<Posting>): Inventory {
  const inventory = new Inventory();
  for (let i = 0; i < postings.length; i++) {
    const posting = postings[i];
    if (posting.meta[AUTOMATIC_RESIDUAL]) {
      continue;
    }
    inventory.addAmount(getWeight(posting));
  }
  return inventory;
}

export function inferTolerances(
  postings: ArrayLike<Posting>,
  options: BeancountOptions,
  useCost: boolean | null = null,
): Record<string, Decimal> {
  useCost = useCost === null ? options.infer_tolerance_from_cost : useCost;
  const inferredToleranceMultiplier = options.inferred_tolerance_multiplier;
  const tolerances: Record<string, Decimal> = {};
  for (const [key, value] of Object.entries(
    options.inferred_tolerance_default || {},
  )) {
    tolerances[key] = new Decimal(value);
  }
  const costTolerances: Record<string, Decimal> = {};

  for (let i = 0; i < postings.length; i++) {
    const posting = postings[i];
    if (posting.meta[AUTOMATIC_RESIDUAL]) {
      continue;
    }
    const units = posting.units;
    if (!units) {
      continue;
    }
    const currency = units.currency || "";
    const expo = units.exponent;

    if (expo < 0) {
      // Note: the exponent is a negative value.
      const tolerance = new Decimal(1)
        .scaleb(expo)
        .mul(inferredToleranceMultiplier);

      // Note that we take the max() and not the min() here because the
      // tolerance has a dual purpose: it's used to infer the resolution
      // for interpolation (where we might want the min()) and also for
      // balance checks (where we favor the looser/larger tolerance).
      tolerances[currency] = Decimal.max(
        tolerance,
        tolerances[currency] || -1024,
      );

      if (!useCost) {
        continue;
      }

      const cost = posting.cost;
      let costCurrency: string;
      let costTolerance: Decimal;
      if (cost) {
        if (cost instanceof Cost) {
          costCurrency = cost.amount?.currency?.toString() || "";
          const amount = cost.amount || new Amount(0, costCurrency);
          costTolerance = Decimal.min(
            amount.mul(tolerance).number,
            MAXIMUM_TOLERANCE,
          );
        } else {
          costCurrency = cost.currency ?? "";
          costTolerance = MAXIMUM_TOLERANCE;
          [cost.numberTotal, cost.numberPer]
            .filter((it) => it !== null)
            .forEach((costNum) => {
              costTolerance = Decimal.min(
                tolerance.mul(costNum),
                costTolerance,
              );
            });
        }
        costTolerances[costCurrency] ||= Decimal.ZERO;
        costTolerances[costCurrency] =
          costTolerances[costCurrency].plus(costTolerance);
      }

      const price = posting.price;
      if (price) {
        const priceTolerance = Decimal.min(
          tolerance.mul(price.number),
          MAXIMUM_TOLERANCE,
        );
        costTolerances[price.currency ?? ""] ||= Decimal.ZERO;
        costTolerances[price.currency ?? ""] =
          costTolerances[price.currency ?? ""].plus(priceTolerance);
      }

      Object.keys(costTolerances).forEach((k) => {
        tolerances[k] = Decimal.max(tolerance, costTolerances[k] || -1024);
      });
    }
  }

  return tolerances;
}

/**
 * Quantize the units using the tolerance dict.
 *
 * @param tolerances A dict of currency to tolerance Decimalvalues.
 * @param currency A string currency.
 * @param amount A number to quantize.
 * @returns A Decimal, the number possibly quantized.
 */
export function quantizeWithTolerance(
  tolerances: Record<string, Decimal>,
  amount: Amount,
  defaultTolerance: Decimal = new Decimal(0.000005),
): Amount {
  // Applying rounding to the default tolerance, if there is one.
  const currency = amount.currency || "";
  const tolerance = tolerances[currency] || defaultTolerance;
  if (tolerance) {
    const quantum = new Amount(tolerance).mul(2);
    if (quantum.digits().length < MAX_TOLERANCE_DIGITS) {
      return amount.quantize(quantum);
    }
  }
  return amount;
}
