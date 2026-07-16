import type { BeancountOptions } from "../core";
import { getAccounts, getOpenClose } from "../core";
import { Transaction, type Directives } from "../core/data";
import { ValidationError } from "../ops/validation";

/** Reports transaction postings to accounts that have a known child account. */
export function validateLeafOnly(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const accounts = getAccounts(entries);
  const postedAccounts = new Set<string>();
  for (const entry of entries) {
    if (entry instanceof Transaction) {
      entry.postings.forEach((posting) => postedAccounts.add(posting.account));
    }
  }

  const openClose = getOpenClose(entries);
  const errors: ValidationError[] = [];
  for (const account of [...postedAccounts].sort()) {
    if (
      ![...accounts].some((candidate) => candidate.startsWith(`${account}:`))
    ) {
      continue;
    }
    const open = openClose.get(account)?.open;
    errors.push(
      new ValidationError(
        `Non-leaf account '${account}' has postings on it`,
        open ?? { filename: "<leafonly>", lineno: 0 },
      ),
    );
  }
  return [entries, errors];
}
