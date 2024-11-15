import { BeancountOptions } from "../core";
import { isDescendantOf } from "../core/account";
import {
  Balance,
  type Directive,
  type Directives,
  Pad,
  sorted,
  TxnPosting,
  Transaction,
  FLAG_PADDING,
  Posting,
} from "../core/data";
import { Inventory } from "../core/inventory";
import { Position } from "../core/position";
import { entriesByAccount } from "../core/realization";
import { balanceTolerance } from "./balance";
import { ValidationError } from "./validation";

/**
 * Insert transaction entries for to fulfill a subsequent balance check.
 *
 * Synthesize and insert Transaction entries right after Pad entries in order to
 * fulfill checks in the padded accounts. Returns a new list of entries. Note
 * that this doesn't pad across parent-child relationships, it is a very simple
 * kind of pad. (I have found this to be sufficient in practice, and simpler to
 * implement and understand.)
 *
 * Furthermore, this pads for a single currency only, that is, balance checks
 * are specified only for one currency at a time, and pads will only be inserted
 * for those currencies.
 *
 * @param entries A list of directives.
 * @param options A parser options dict.
 * @returns A new list of directives, with Pad entries inserted, and a list of
 *   new errors produced.
 */
export function pad(
  entries: Directives,
  options: BeancountOptions,
): [Directives, Array<ValidationError>] {
  const errors: Array<ValidationError> = [];
  // Find all the pad entries and group them by account.
  const pads = entries.filter((it) => it instanceof Pad);
  const padDict: Record<string, Array<Pad>> = {};
  pads.reduce((acc, cur) => {
    acc[cur.account] ||= [];
    acc[cur.account].push(cur);
    return acc;
  }, padDict);
  // Partially realize the postings, so we can iterate them by account.
  const byAccount = entriesByAccount(entries);
  const newEntries: WeakMap<Pad, Array<Transaction>> = new WeakMap();
  pads.forEach((it) => newEntries.set(it, []));

  for (const [account] of Object.entries(padDict)) {
    let activePad: Pad;
    const postings: Array<Directive> = [];
    for (const [itemAccount, itemPostings] of Object.entries(byAccount)) {
      if (isDescendantOf(account, itemAccount)) {
        postings.push(...itemPostings);
      }
    }
    sorted(postings);
    // A set of currencies already padded so far in this account.
    let paddedLots = new Set();
    const padBalance = new Inventory();

    postings.forEach((entry) => {
      if (entry instanceof TxnPosting) {
        // This is a transaction; update the running balance for this account
        padBalance.addAmount(entry.posting.units, entry.posting.resolvedCost);
      } else if (entry instanceof Pad) {
        // Mark this newly encountered pad as active and allow all lots
        // to be padded heretofore.
        activePad = entry;
        paddedLots = new Set();
      } else if (entry instanceof Balance) {
        const checkAmount = entry.amount;
        // Compare the current balance amount to the expected one from
        // the check entry. IMPORTANT: You need to understand that this
        // does not check a single position, but rather checks that the
        // total amount for a particular currency (which itself is
        // distinct from the cost).
        const balanceAmount = padBalance.currencyUnits(checkAmount.currency);
        const diffAmount = balanceAmount.sub(checkAmount);

        // Use the specified tolerance or automatically infer it.
        const tolerance = balanceTolerance(entry, options);
        if (diffAmount.abs().gt(tolerance)) {
          // The check fails; we need to pad.

          // Pad only if pad entry is active and we haven't already
          // padded that lot since it was last encountered.
          if (activePad && !paddedLots.has(checkAmount.currency)) {
            // Note: we decide that it's an error to try to pad
            // positions at cost; we check here that all the existing
            // positions with that currency have no cost.
            const positions = padBalance.positions.filter(
              (it) => it.units.currency === checkAmount.currency,
            );
            if (positions.some((it) => it.cost)) {
              errors.push(
                new ValidationError(
                  `Attempt to pad an entry with cost for balance: ${padBalance}`,
                  entry,
                ),
              );
            }

            // Thus our padding lot is without cost by default.
            const diffPosition = new Position(checkAmount.sub(balanceAmount));

            // Synthesize a new transaction entry for the difference.
            const narration = `(Padding inserted for Balance of ${checkAmount} for difference ${diffPosition})`;
            const newEntry = new Transaction(
              activePad.date,
              FLAG_PADDING,
              narration,
              "",
              [],
              [],
              [
                new Posting(
                  activePad.account,
                  diffPosition.units,
                  diffPosition.cost,
                ),
                new Posting(
                  activePad.sourceAccount,
                  diffPosition.units.neg(),
                  diffPosition.cost,
                ),
              ],
              { ...activePad.meta },
            );
            newEntries.get(activePad)!.push(newEntry);
            const [pos] = padBalance.addPosition(diffPosition);
            if (pos && pos.isNegativeAtCost) {
              throw new Error(`Position held at cost goes negative: ${pos}`);
            }
          }
        }
        paddedLots.add(checkAmount.currency);
      }
    });
  }

  // Insert the newly created entries right after the pad entries that created them.
  const paddedEntries: Directives = [];

  entries.forEach((entry) => {
    paddedEntries.push(entry);
    if (entry instanceof Pad) {
      const entryList = newEntries.get(entry);
      if (entryList && entryList.length) {
        paddedEntries.push(...entryList);
      } else {
        errors.push(new ValidationError(`Unused pad entry`, entry));
      }
    }
  });

  return [paddedEntries, errors];
}
