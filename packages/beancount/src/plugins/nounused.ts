import type { BeancountOptions } from "../core";
import { getEntryAccounts } from "../core";
import { Open, type Directives } from "../core/data";
import { ValidationError } from "../ops/validation";

/** Reports open accounts that are never referenced by a later ledger directive. */
export function validateUnusedAccounts(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const opens = new Map<string, Open>();
  const referenced = new Set<string>();
  for (const entry of entries) {
    if (entry instanceof Open) {
      opens.set(entry.account, entry);
    } else {
      getEntryAccounts(entry).forEach((account) => referenced.add(account));
    }
  }
  return [
    entries,
    [...opens.entries()]
      .filter(([account]) => !referenced.has(account))
      .map(
        ([account, open]) =>
          new ValidationError(`Unused account '${account}'`, open),
      ),
  ];
}
