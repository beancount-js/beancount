import type { BeancountOptions } from "../core";
import { Balance, Price, type Directives } from "../core/data";
import { ValidationError } from "../ops/validation";

/** Reports duplicate directives while deliberately allowing duplicate balances and prices. */
export function validateNoDuplicates(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const seen = new Map<string, (typeof entries)[number]>();
  const errors: ValidationError[] = [];
  for (const entry of entries) {
    if (entry instanceof Balance || entry instanceof Price) continue;
    const previous = seen.get(entry.id);
    if (previous) {
      errors.push(
        new ValidationError(`Duplicate entry: ${entry.toString()}`, {
          directive: entry,
          duplicate: previous,
        }),
      );
    } else {
      seen.set(entry.id, entry);
    }
  }
  return [entries, errors];
}
