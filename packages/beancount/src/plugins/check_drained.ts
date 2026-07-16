import {
  AccountTypes,
  Amount,
  Balance,
  Close,
  Open,
  Transaction,
  type BeancountOptions,
  type Directives,
} from "../core";
import type { ValidationError } from "../ops/validation";

/** Inserts next-day zero balance checks for currencies seen in closed balance-sheet accounts. */
export function checkDrained(
  entries: Directives,
  options: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const accountTypes = new AccountTypes(options);
  const currencies = new Map<string, Set<string>>();
  const balances = new Set<string>();
  const add = (account: string, currency: string | null) => {
    if (!currency || !accountTypes.isBalanceSheetAccount(account)) return;
    const values = currencies.get(account) ?? new Set<string>();
    values.add(currency);
    currencies.set(account, values);
  };
  const response: Directives = [];
  for (const entry of entries) {
    if (entry instanceof Transaction)
      entry.postings.forEach((posting) =>
        add(posting.account, posting.units?.currency ?? null),
      );
    if (entry instanceof Open)
      entry.currencies.forEach((currency) => add(entry.account, currency));
    if (
      entry instanceof Balance &&
      accountTypes.isBalanceSheetAccount(entry.account)
    )
      balances.add(
        `${entry.account}\u0000${entry.date.toISODate()}\u0000${entry.amount.currency}`,
      );
    if (
      entry instanceof Close &&
      accountTypes.isBalanceSheetAccount(entry.account)
    ) {
      for (const currency of currencies.get(entry.account) ?? []) {
        if (
          balances.has(
            `${entry.account}\u0000${entry.date.toISODate()}\u0000${currency}`,
          )
        )
          continue;
        response.push(
          new Balance(
            entry.date.plus({ days: 1 }),
            entry.account,
            new Amount(0, currency),
            null,
            "",
            entry.meta,
          ),
        );
      }
    }
    response.push(entry);
  }
  return [response, []];
}
