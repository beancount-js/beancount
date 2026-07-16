import type { BeancountOptions } from "../core";
import { Price, type Directives } from "../core/data";
import { ValidationError } from "../ops/validation";

/** Reports conflicting same-day price declarations for the same base/quote pair. */
export function validateUniquePrices(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const prices = new Map<string, Price[]>();
  for (const entry of entries) {
    if (!(entry instanceof Price)) continue;
    const key = `${entry.date.toISODate()}\u0000${entry.currency}\u0000${entry.amount.currency}`;
    const values = prices.get(key) ?? [];
    values.push(entry);
    prices.set(key, values);
  }

  const errors: ValidationError[] = [];
  for (const priceEntries of prices.values()) {
    const distinct = new Map<string, Price>();
    for (const entry of priceEntries)
      distinct.set(entry.amount.value.value, entry);
    if (distinct.size > 1) {
      errors.push(
        new ValidationError("Disagreeing price entries", {
          directive: distinct.values().next().value!,
          entries: priceEntries,
        }),
      );
    }
  }
  return [entries, errors];
}
