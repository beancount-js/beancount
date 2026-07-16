import {
  Balance,
  type Directives,
  Transaction,
  isDescendantOf,
  accountOpenClose,
} from "../core";
import type { BeancountOptions } from "../core";
import { ValidationError } from "./validation";
import { RealAccount } from "../core/realization";
import { Decimal } from "@beancount-js/parser";

export function balanceTolerance(
  balance: Balance,
  options: BeancountOptions,
): Decimal {
  let tolerance: Decimal;

  if (balance.tolerance) {
    tolerance = new Decimal(balance.tolerance);
  } else {
    const expo = balance.amount.exponent;
    if (expo < 0) {
      tolerance = options.tolerance_multiplier
        .mul(2)
        .mul(new Decimal(1).scaleb(expo));
    } else {
      tolerance = new Decimal(0);
    }
  }
  return tolerance;
}

/**
 * Process the balance assertion directives.
 *
 * For each Balance directive, check that their expected balance corresponds to
 * the actual balance computed at that time and replace failing ones by new ones
 * with a flag that indicates failure.
 *
 * @param entries A list of directives.
 * @param options A dict of options, parsed from the input file.
 * @returns A pair of a list of directives and a list of balance check errors.
 */
export function checkBalance(
  entries: Directives,
  options: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const errors: Array<ValidationError> = [];
  const root = new RealAccount("");
  const assertedAccounts = entries
    .filter((it) => it instanceof Balance)
    .map((it) => it.account);
  const accounts = [...new Set(entries.map((it) => it.accounts).flat())];
  accounts.forEach((account) => {
    if (assertedAccounts.some((it) => isDescendantOf(it, account))) {
      root.getOrCreate(account);
    }
  });
  const openCloseMap = accountOpenClose(entries);
  const newEntries: Directives = [];
  entries.forEach((entry) => {
    if (entry instanceof Transaction) {
      entry.postings.forEach((posting) => {
        const acc = root.get(posting.account);

        // The account will have been created only if we're meant to track it.
        if (acc && posting.units) {
          // Note: Always allow negative lots for the purpose of balancing.
          // This error should show up somewhere else than here.
          acc.balance.addAmount(posting.units, posting.resolvedCost);
        }
      });
    } else if (entry instanceof Balance) {
      const expectedAmount = entry.amount;
      const expectedCurrency = expectedAmount.currency || "";
      const open = openCloseMap[entry.account]?.open;
      if (!open) {
        errors.push(
          new ValidationError(
            `Invalid reference to unknown account '${entry.account}'`,
            entry,
          ),
        );
      }

      if (
        expectedAmount &&
        open &&
        open.currencies.length &&
        !open.currencies.includes(expectedCurrency)
      ) {
        errors.push(
          new ValidationError(
            `Invalid currency '${expectedCurrency}' for Balance directive`,
            entry,
          ),
        );
      }

      const account = root.get(entry.account);
      if (!account) {
        throw Error(`missing account: ${entry.account}`);
      }

      const subtreeBalance = account.computeBalance(false);
      // Get only the amount in the desired currency.
      const balanceAmount = subtreeBalance.currencyUnits(
        expectedAmount.currency,
      );
      // Check if the amount is within bounds of the expected amount.
      const diffAmount = balanceAmount.sub(expectedAmount);
      // Use the specified tolerance or automatically infer it.
      const tolerance = balanceTolerance(entry, options);
      if (diffAmount.abs().gt(tolerance)) {
        errors.push(
          new ValidationError(
            `Balance failed for '${entry.account}':\nexpected ${expectedAmount} != accumulated ${balanceAmount} (${diffAmount.abs()} ${diffAmount.gt(0) ? "too much" : "too little"})`,
            entry,
          ),
        );

        // Substitute the entry by a failing entry, with the diff_amount
        // field set on it. I'm not entirely sure that this is the best
        // of ideas, maybe leaving the original check intact and insert a
        // new error entry might be more functional or easier to
        // understand.
        entry = entry.copy({ diff: diffAmount });
      }
    }

    newEntries.push(entry);
  });

  return [newEntries, errors];
}
