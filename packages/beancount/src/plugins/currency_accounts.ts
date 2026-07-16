import type { BeancountOptions } from "../core";
import {
  Amount,
  Inventory,
  Open,
  Posting,
  Transaction,
  type Directives,
} from "../core";
import { getCost } from "../core/convert";
import { isValidAccount, joinAccount } from "../core/account";
import { ValidationError } from "../ops/validation";

export const CURRENCY_ACCOUNTS_META = "currency_accounts_processed";
export const DEFAULT_CURRENCY_ACCOUNTS = "Equity:CurrencyAccounts";

function groupPostingsByWeightCurrency(entry: Transaction) {
  const groups = new Map<string, Posting[]>();
  let hasPrice = false;
  for (const posting of entry.postings) {
    const currency =
      (posting.cost ? posting.cost.currency : null) ?? posting.units?.currency;
    if (!currency) continue;
    if (posting.price) hasPrice = true;
    const postings = groups.get(currency) ?? [];
    postings.push(posting);
    groups.set(currency, postings);
  }
  return [groups, hasPrice] as const;
}

function neutralizePostings(
  groups: ReadonlyMap<string, readonly Posting[]>,
  baseAccount: string,
  newAccounts: Set<string>,
) {
  const postings: Posting[] = [];
  for (const [currency, group] of groups) {
    const inventory = new Inventory();
    group.forEach((posting) => inventory.addAmount(getCost(posting)));
    if (inventory.isEmpty()) {
      postings.push(...group);
      continue;
    }
    postings.push(...group.map((posting) => posting.copy({ price: null })));
    const amount = inventory.getOnlyPosition()!.units;
    const account = joinAccount(baseAccount, currency);
    newAccounts.add(account);
    postings.push(new Posting(account, amount.neg()));
  }
  return postings;
}

/** Inserts currency trading postings and account opens for priced multi-currency transactions. */
export function insertCurrencyTradingPostings(
  entries: Directives,
  _options?: BeancountOptions,
  config = "",
): [Directives, Array<ValidationError>] {
  if (entries.length === 0) return [entries, []];
  const configuredAccount = config.trim();
  const baseAccount = isValidAccount(configuredAccount)
    ? configuredAccount
    : DEFAULT_CURRENCY_ACCOUNTS;
  const newAccounts = new Set<string>();
  const transformed: Directives = entries.map((entry) => {
    if (!(entry instanceof Transaction)) return entry;
    const [groups, hasPrice] = groupPostingsByWeightCurrency(entry);
    if (!hasPrice || groups.size < 2) return entry;
    return entry.copy({
      postings: neutralizePostings(groups, baseAccount, newAccounts),
      meta: { ...entry.meta, [CURRENCY_ACCOUNTS_META]: true },
    });
  });
  const earliestDate = entries[0].date;
  if (!earliestDate) return [transformed, []];
  const opens = [...newAccounts].sort().map(
    (account, index) =>
      new Open(earliestDate, account, [], undefined, {
        filename: "<currency_accounts>",
        lineno: index,
      }),
  );
  return [[...opens, ...transformed], []];
}
