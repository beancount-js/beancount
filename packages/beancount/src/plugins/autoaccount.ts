import { DateTime } from "luxon";
import { Open, sorted, type Directives } from "../core/data";
import type { ValidationError } from "../ops/validation";
import { BeancountOptions } from "../core";

function accountsUseMap(entries: Directives) {
  entries = sorted([...entries]);
  const first: Record<string, DateTime> = {};
  const last: Record<string, DateTime> = {};
  entries.forEach((entry) => {
    const date = entry.date;
    if (!date) {
      return;
    }
    entry.accounts.forEach((account) => {
      if (!first[account]) {
        first[account] = date;
      }
      last[account] = date;
    });
  });

  return [first, last];
}
/**
 * This module automatically inserts Open directives for accounts not opened (at
 * the date of the first entry) and automatically removes open directives for
 * unused accounts. This can be used as a convenience for doing demos, or when
 * setting up your initial transactions, as an intermediate step.
 *
 * @param entries
 * @param options
 * @returns
 */
export function autoInsertOpen(
  entries: Directives,
  _options?: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const response: Directives = sorted([...entries]);
  const errors: Array<ValidationError> = [];
  const openedAccounts = new Set<string>(
    entries.filter((it) => it instanceof Open).map((it) => it.account),
  );
  const [first] = accountsUseMap(entries);
  for (const [account, date] of Object.entries(first)) {
    if (!openedAccounts.has(account)) {
      response.push(
        new Open(date, account, undefined, undefined, { "<auto_accounts>": 0 }),
      );
    }
  }

  return [sorted(response), errors];
}
