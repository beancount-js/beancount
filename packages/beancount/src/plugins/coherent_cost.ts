import type { BeancountOptions } from "../core";
import { Transaction, type Directives } from "../core/data";
import { ValidationError } from "../ops/validation";

/** Validates that a units currency is never used both with and without a lot cost. */
export function validateCoherentCost(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const withCost = new Map<string, Transaction>();
  const withoutCost = new Map<string, Transaction>();
  for (const entry of entries) {
    if (!(entry instanceof Transaction)) continue;
    for (const posting of entry.postings) {
      const currency = posting.units?.currency;
      if (!currency) continue;
      (posting.cost ? withCost : withoutCost).set(currency, entry);
    }
  }

  const errors: ValidationError[] = [];
  for (const [currency, costEntry] of withCost) {
    const plainEntry = withoutCost.get(currency);
    if (!plainEntry) continue;
    errors.push(
      new ValidationError(
        `Currency '${currency}' is used both with and without cost`,
        { directive: costEntry, conflictingDirective: plainEntry },
      ),
    );
  }
  return [entries, errors];
}
