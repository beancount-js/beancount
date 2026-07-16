import type { BeancountOptions } from "../core";
import {
  Booking,
  Cost,
  Inventory,
  Transaction,
  type Directives,
} from "../core";
import { getOpenClose } from "../core/getters";
import { ValidationError } from "../ops/validation";

const DEFAULT_TOLERANCE = 0.01;
const FLOAT = /^[+-]?(?:\d+\.\d*|\d*\.\d+)(?:e[+-]?\d+)?$/i;

function toleranceFrom(config: string | undefined) {
  if (!config?.trim()) return DEFAULT_TOLERANCE;
  const text = config.trim();
  if (!FLOAT.test(text)) {
    throw new Error(
      "Invalid configuration for check_average_cost: must be a float",
    );
  }
  return Number(text);
}

/** Checks that reductions in NONE-booked accounts preserve the prior average cost. */
export function validateAverageCost(
  entries: Directives,
  _options?: BeancountOptions,
  config?: string,
): [Directives, Array<ValidationError>] {
  const tolerance = toleranceFrom(config);
  const minimum = 1 - tolerance;
  const maximum = 1 + tolerance;
  const opens = getOpenClose(entries);
  const balances = new Map<string, Inventory>();
  const errors: ValidationError[] = [];

  for (const entry of entries) {
    if (!(entry instanceof Transaction)) continue;
    for (const posting of entry.postings) {
      const open = opens.get(posting.account)?.open;
      if (
        open?.booking !== Booking.NONE ||
        !posting.units ||
        !(posting.cost instanceof Cost)
      ) {
        continue;
      }
      const costCurrency = posting.cost.currency;
      const key = `${posting.account}\u0000${posting.units.currency}\u0000${costCurrency}`;
      const balance = balances.get(key) ?? new Inventory();
      balances.set(key, balance);

      if (posting.units.lt(0)) {
        const average = balance.average().getOnlyPosition();
        const averageCost = average?.cost?.amount;
        if (averageCost && posting.cost.amount) {
          const actual = posting.cost.amount.value;
          const expected = averageCost.value;
          if (
            actual.lt(expected.mul(minimum)) ||
            actual.gt(expected.mul(maximum))
          ) {
            errors.push(
              new ValidationError(
                `Cost basis on reducing posting is too far from the average cost (${actual.value} vs. ${expected.value})`,
                entry,
              ),
            );
          }
        }
      }
      balance.addPosting(posting);
    }
  }
  return [entries, errors];
}
