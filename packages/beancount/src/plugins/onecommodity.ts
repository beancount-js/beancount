import type { BeancountOptions } from "../core";
import { Balance, Open, Transaction, type Directives } from "../core/data";
import { ValidationError } from "../ops/validation";

type CurrencyUse = {
  currencies: Set<string>;
  source: Balance | Transaction | null;
};

function record(
  uses: Map<string, CurrencyUse>,
  account: string,
  currency: string | null,
  source: Balance | Transaction,
) {
  if (!currency) return;
  const use = uses.get(account) ?? { currencies: new Set(), source: null };
  use.currencies.add(currency);
  if (use.currencies.size > 1) use.source = source;
  uses.set(account, use);
}

/** Validates that each selected account uses at most one units and cost currency. */
export function validateOneCommodity(
  entries: Directives,
  _options?: BeancountOptions,
  config?: string,
): [Directives, Array<ValidationError>] {
  const matcher = config ? new RegExp(config) : null;
  const skipped = new Set<string>();
  for (const entry of entries) {
    if (!(entry instanceof Open)) continue;
    if (
      entry.meta.onecommodity === false ||
      (matcher && !matcher.test(entry.account)) ||
      entry.currencies.length > 1
    ) {
      skipped.add(entry.account);
    }
  }

  const units = new Map<string, CurrencyUse>();
  const costs = new Map<string, CurrencyUse>();
  for (const entry of entries) {
    if (entry instanceof Transaction) {
      for (const posting of entry.postings) {
        if (skipped.has(posting.account)) continue;
        record(units, posting.account, posting.units?.currency ?? null, entry);
        record(
          costs,
          posting.account,
          posting.resolvedCost?.amount?.currency ?? null,
          entry,
        );
      }
    } else if (entry instanceof Balance && !skipped.has(entry.account)) {
      record(units, entry.account, entry.amount.currency, entry);
    }
  }

  const errors: ValidationError[] = [];
  for (const [account, use] of units) {
    if (skipped.has(account) || use.currencies.size < 2) continue;
    errors.push(
      new ValidationError(
        `More than one currency in account '${account}': ${[...use.currencies].join(",")}`,
        use.source ?? { filename: "<onecommodity>", lineno: 0 },
      ),
    );
  }
  for (const [account, use] of costs) {
    if (skipped.has(account) || use.currencies.size < 2) continue;
    errors.push(
      new ValidationError(
        `More than one cost currency in account '${account}': ${[...use.currencies].join(",")}`,
        use.source ?? { filename: "<onecommodity>", lineno: 0 },
      ),
    );
  }
  return [entries, errors];
}
