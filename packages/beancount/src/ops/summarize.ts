import { DateTime } from "luxon";
import {
  AccountTypes,
  Amount,
  computeEntriesBalance,
  DefaultMap,
  getCost,
  getLastPriceEntries,
  Inventory,
} from "../core";
import type { BeancountOptions, Directives } from "../core";
import {
  FLAG_CONVERSIONS,
  FLAG_TRANSFER,
  Posting,
  Transaction,
  Balance,
  FLAG_SUMMARIZE,
  Close,
  sorted,
  Open,
} from "../core/data";
import { bisectLeftWithKey } from "../utils";

/**
 * Transfer income and expenses balances at the given date to the equity
 * accounts. This method insert entries to zero out balances on income and
 * expenses accounts by transferring them to an equity account.
 *
 * @param entries A list of directive tuples.
 * @param date A datetime.date instance, one day beyond the end of the period.
 *   This date can be optionally left to None in order to close at the end of
 *   the list of entries.
 * @param props Account_types: An instance of AccountTypes. account_earnings: A
 *   string, the name of the account to transfer previous earnings from the
 *   income statement accounts to the balance sheet.
 */
export function clear(
  entries: Directives,
  date: DateTime | null,
  accountTypes: AccountTypes,
  transferAccount: string = accountTypes.currentEarnings,
): [Directives, number] {
  const index = entries.length;
  const newEntries = transferBalances(
    entries,
    date,
    (account) => accountTypes.isIncomeAccount(account),
    transferAccount,
  );
  return [newEntries, index];
}

export function clearOpts(
  entries: Directives,
  date: DateTime,
  options: BeancountOptions,
) {
  const accountTypes = new AccountTypes(options);
  return clear(entries, date, accountTypes, accountTypes.currentEarnings);
}

/**
 * Summarize entries before a date and transfer income/expenses to equity.
 *
 *     This method essentially prepares a list of directives to contain only
 *     transactions that occur after a particular date. It truncates the past. To
 *     do so, it will
 *
 *     1. Insert conversion transactions at the given open date, then
 *
 *     2. Insert transactions at that date to move accumulated balances from before
 *        that date from the income and expenses accounts to an equity account, and
 *        finally
 *
 *     3. It removes all the transactions previous to the date and replaces them by
 *        opening balances entries to bring the balances to the same amount.
 *
 *     The result is a list of entries for which the income and expense accounts
 *     are beginning with a balance of zero, and all other accounts begin with a
 *     transaction that brings their balance to the expected amount. All the past
 *     has been summarized at that point.
 *
 *     An index is returned to the first transaction past the balance opening
 *     transactions, so you can keep just those in order to render a balance sheet
 *     for only the opening balances.
 *
 * @param entries A list of directive tuples.
 * @param date A datetime.date instance, the date at which to do this.
 * @param accountTypes An instance of AccountTypes.
 * @param conversionCurrency A string, the transfer currency to use for zero
 *   prices on the conversion entry.
 * @param accountEarnings A string, the name of the account to transfer previous
 *   earnings from the income statement accounts to the balance sheet.
 * @param accountOpening A string, the name of the account in equity to transfer
 *   previous balances from, in order to initialize account balances at the
 *   beginning of the period. This is typically called an opening balances
 *   account.
 * @param accountConversions A string, the name of the equity account to book
 *   currency conversions against.
 * @returns A new list of entries is returned, and the index that points to the
 *   first original transaction after the beginning date of the period. This
 *   index can be used to generate the opening balances report, which is a
 *   balance sheet fed with only the summarized entries.
 */
export function open(
  entries: Directives,
  date: DateTime,
  accountTypes: AccountTypes,
  conversionCurrency: string,
  accountEarnings: string,
  accountOpening: string,
  accountConversions: string,
): [Directives, number] {
  const conversionEntries = conversions(
    entries,
    accountConversions,
    conversionCurrency,
    date,
  );
  const [clearEntries] = clear(
    conversionEntries,
    date,
    accountTypes,
    accountEarnings,
  );
  return summarize(clearEntries, date, accountOpening);
}

export function openOpts(
  entries: Directives,
  date: DateTime,
  options: BeancountOptions,
) {
  const accountTypes = new AccountTypes(options);
  const [previousEarnings, previousBalances, previousConversions] =
    accountTypes.previousAccounts();
  return open(
    entries,
    date,
    accountTypes,
    options.conversion_currency,
    previousEarnings,
    previousBalances,
    previousConversions,
  );
}

/**
 * Truncate entries that occur after a particular date and ensure balance.
 *
 *     This method essentially removes entries after a date. It truncates the
 *     future. To do so, it will
 *
 *     1. Remove all entries which occur after 'date', if given.
 *
 *     2. Insert conversion transactions at the end of the list of entries to
 *        ensure that the total balance of all postings sums up to empty.
 *
 *     The result is a list of entries with a total balance of zero, with possibly
 *     non-zero balances for the income/expense accounts. To produce a final
 *     balance sheet, use transfer() to move the net income to the equity accounts.
 *
 * @param entries A list of directive tuples.
 * @param date A datetime.date instance, one day beyond the end of the period.
 *   This date can be optionally left to None in order to close at the end of
 *   the list of entries.
 * @param conversionCurrency A string, the transfer currency to use for zero
 *   prices on the conversion entry.
 * @param conversionAccount A string, the name of the equity account to book
 *   currency conversions against.
 * @returns A new list of entries is returned, and the index that points to one
 *   beyond the last original transaction that was provided. Further entries may
 *   have been inserted to normalize conversions and ensure the total balance
 *   sums to zero.
 */
export function close(
  entries: Directives,
  date: DateTime | null,
  conversionCurrency: string,
  conversionAccount: string,
): [Directives, number] {
  entries = date ? truncate(entries, date) : entries;
  const index = entries.length;
  entries = conversions(entries, conversionAccount, conversionCurrency, date);
  return [entries, index];
}

export function closeOpts(
  entries: Directives,
  date: DateTime,
  options: BeancountOptions,
) {
  const accountTypes = new AccountTypes(options);
  return close(
    entries,
    date,
    options.conversion_currency,
    accountTypes.currentConversions,
  );
}

/**
 * Summarize all entries before a date by replacing then with summarization
 * entries.
 *
 *     This function replaces the transactions up to (and not including) the given
 *     date with a opening balance transactions, one for each account. It returns
 *     new entries, all of the transactions before the given date having been
 *     replaced by a few summarization entries, one for each account.
 *
 *     Notes:
 *     - Open entries are preserved for active accounts.
 *     - The last relevant price entry for each (base, quote) pair is preserved.
 *     - All other entries before the cutoff date are culled.
 *
 * @param entries A list of directives.
 * @param date A datetime.date instance, the cutoff date before which to
 *   summarize.
 * @param accountOpening A string, the name of the source account to book
 *   summarization entries against.
 * @returns The function returns a list of new entries and the integer index at
 *   which the entries on or after the cutoff date begin.
 */
export function summarize(
  entries: Directives,
  date: DateTime,
  accountOpening: string,
): [Directives, number] {
  const [balances, index] = balanceByAccount(entries, date);
  const summarizeDate = date.minus({ day: 1 });
  const summarizingEntries = createEntriesFromBalances(
    balances,
    summarizeDate,
    accountOpening,
    true,
    FLAG_SUMMARIZE,
    `Opening balance for '{account}' (Summarization)`,
    { "<summarize>": 0 },
  );

  const priceEntries = getLastPriceEntries(summarizingEntries, date);
  const openEntries = getOpenEntries(entries, date);

  const beforeEntries = sorted([
    ...openEntries,
    ...priceEntries,
    ...summarizingEntries,
  ]);
  const afterEntries = entries.slice(index);

  return [[...beforeEntries, ...afterEntries], beforeEntries.length];
}

/**
 * Filter out all the entries at and after date. Returns a new list of entries.
 *
 * @param entries A sorted list of directives.
 * @param date A datetime.date instance.
 * @returns A truncated list of directives.
 */
export function truncate(entries: Directives, date: DateTime) {
  const index = bisectLeftWithKey(
    entries,
    date.toMillis(),
    (key) => key.date?.toMillis() ?? 0,
  );
  return entries.slice(undefined, index);
}

/**
 * Gather the list of active Open entries at date.
 *
 *     This returns the list of Open entries that have not been closed at the given
 *     date, in the same order they were observed in the document.
 *
 * @param entries A list of directives.
 * @param date The date at which to look for an open entry. If not specified,
 *   will return the entries still open at the latest date.
 * @returns A list of Open directives.
 */
export function getOpenEntries(entries: Directives, date: DateTime) {
  const openEntries: Record<string, [number, Open]> = {};
  for (const [index, entry] of entries.entries()) {
    if (date && entry.date && entry.date >= date) {
      break;
    }

    if (entry instanceof Open) {
      if (openEntries[entry.account]) {
        const [_, exEntry] = openEntries[entry.account];
        if (entry.date < exEntry.date) {
          openEntries[entry.account] = [index, entry];
        }
      } else {
        openEntries[entry.account] = [index, entry];
      }
    } else if (entry instanceof Close) {
      delete openEntries[entry.account];
    }
  }
  return Object.values(openEntries)
    .sort((a, b) => a[0] - b[0])
    .map((it) => it[1]);
}

/**
 * Synthesize transactions to transfer balances from some accounts at a given
 * date.
 *
 *     For all accounts that match the 'account_pred' predicate, create new entries
 *     to transfer the balance at the given date from the account to the transfer
 *     account. This is used to transfer balances from income and expenses from a
 *     previous period to a "retained earnings" account. This is accomplished by
 *     creating new entries.
 *
 *     Note that inserting transfers breaks any following balance checks that are
 *     in the transferred accounts. For this reason, all balance assertion entries
 *     following the cutoff date for those accounts are removed from the list in
 *     output.
 *
 * @param entries A list of directives.
 * @param date A datetime.date instance, the date at which to make the transfer.
 * @param predicate A predicate function that, given an account string, returns
 *   true if the account is meant to be transferred.
 * @param transferAccount A string, the name of the source account to be used on
 *   the transfer entries to receive balances at the given date.
 * @returns A new list of entries, with the new transfer entries added in.
 */
export function transferBalances(
  entries: Directives,
  date: DateTime | null,
  predicate: (account: string) => boolean,
  transferAccount: string,
): Directives {
  if (!entries?.length) {
    return [];
  }
  const [balances, index] = balanceByAccount(entries, date);
  const transferBalances = new Map<string, Inventory>(
    [...balances.entries()].filter(([k]) => predicate(k)),
  );
  const transferDate = date ? date.minus({ day: 1 }) : getLastDate(entries)!;

  const transferEntries = createEntriesFromBalances(
    transferBalances,
    transferDate,
    transferAccount,
    false,
    FLAG_TRANSFER,
    "Transfer balance for '{account}' (Transfer balance)",
    { "<transfer_balances>": 0 },
  );

  const afterEntries = entries.slice(index).filter((entry) => {
    return !(entry instanceof Balance && transferBalances.has(entry.account));
  });

  return [
    ...entries.slice(undefined, index),
    ...transferEntries,
    ...afterEntries,
  ];
}

function getLastDate(entries: Directives) {
  return [...entries].reverse().find((it) => it.date)?.date;
}

/**
 * Create a list of entries from a dict of balances.
 *
 *     This method creates a list of new entries to transfer the amounts in the
 *     'balances' dict to/from another account specified in 'source_account'.
 *
 *     The balancing posting is created with the equivalent at cost. In other
 *     words, if you attempt to balance 10 HOOL {500 USD}, this will synthesize a
 *     posting with this position on one leg, and with 5000 USD on the
 *     'source_account' leg.
 *
 * @param balances A dict of account name strings to Inventory instances.
 * @param date A datetime.date object, the date at which to create the
 *   transaction.
 * @param sourceAccount A string, the name of the account to pull the balances
 *   from. This is the magician's hat to pull the rabbit from.
 * @param direction If 'direction' is True, the new entries transfer TO the
 *   balances account from the source account; otherwise the new entries
 *   transfer FROM the balances into the source account.
 * @param flag A string, the flag to use for the transactions.
 * @param narration A format string for creating the narration. It is formatted
 *   with 'account' and 'date' replacement variables.
 * @param metadata A dict to use as metadata for the transactions.
 * @returns A list of newly synthesizes Transaction entries.
 */
function createEntriesFromBalances(
  balances: Map<string, Inventory>,
  date: DateTime,
  sourceAccount: string,
  direction: boolean,
  flag: string,
  narration: string,
  metadata: Record<string, unknown> = {},
) {
  const newEntries: Directives = [];
  // eslint-disable-next-line prefer-const
  for (let [account, accountBalance] of balances.entries()) {
    if (accountBalance.size == 0) {
      continue;
    }
    if (!direction) {
      accountBalance = accountBalance.neg();
    }

    const postings: Posting[] = [];
    accountBalance.positions.forEach((pos) => {
      postings.push(new Posting(account, pos.units, pos.cost));
      const cost = getCost(pos).neg();
      postings.push(new Posting(sourceAccount, cost));
    });
    newEntries.push(
      new Transaction(
        date,
        flag,
        "",
        narration.replaceAll("{account}", account),
        [],
        [],
        postings,
        metadata,
      ),
    );
  }
  return newEntries;
}

/**
 * Sum up the balance per account for all entries strictly before 'date'.
 *
 * @param entries A list of directives.
 * @param date An optional datetime.date instance. If provided, stop
 *   accumulating on and after this date. This is useful for summarization
 *   before a specific date.
 * @returns A pair of a dict of account string to instance Inventory (the
 *   balance of this account before the given date), and the index in the list
 *   of entries where the date was encountered. If all entries are located
 *   before the cutoff date, an index one beyond the last entry is returned.
 */
export function balanceByAccount(
  entries: Directives,
  date: DateTime | null = null,
): [Map<string, Inventory>, number] {
  const balances = new DefaultMap<string, Inventory>(() => new Inventory());
  let index = 0;
  for (const entry of entries) {
    if (date && entry.date && entry.date >= date) {
      break;
    }
    index++;
    if (entry instanceof Transaction) {
      for (const posting of entry.postings) {
        balances.get(posting.account).addPosting(posting);
      }
    }
  }
  return [balances, index];
}

/**
 * Insert a conversion entry at date 'date' at the given account.
 *
 * @param entries A list of entries.
 * @param conversionAccount A string, the account to book against.
 * @param conversionCurrency A string, the transfer currency to use for zero
 *   prices on the conversion entry.
 * @param date The date before which to insert the conversion entry. The new
 *   entry will be inserted as the last entry of the date just previous to this
 *   date.
 * @returns A modified list of entries.
 */
export function conversions(
  entries: Directives,
  conversionAccount: string,
  conversionCurrency: string,
  date?: DateTime | null,
) {
  // Compute the balance at the given date.
  const conversionBalance = computeEntriesBalance(entries, "", date);
  const conversionCostBalance = conversionBalance.reduce(getCost);

  // Early exit if there is nothing to do.
  if (conversionCostBalance.size == 0) {
    return entries;
  }

  let index: number;
  let lastDate: DateTime;

  // Calculate the index and the date for the new entry. We want to store it as
  // the last transaction of the day before.
  if (date) {
    index = bisectLeftWithKey(
      entries,
      date.toMillis(),
      (item) => item.date?.toMillis() ?? 0,
    );
    lastDate = date.minus({ day: 1 });
  } else {
    index = entries.length;
    lastDate = getLastDate(entries)!;
  }

  const postings: Posting[] = [];
  const conversionEntry = new Transaction(
    lastDate,
    FLAG_CONVERSIONS,
    "",
    `Conversion for ${conversionBalance}`,
    [],
    [],
    postings,
    { "<conversions>": -1 },
  );

  conversionBalance.positions.forEach((pos) => {
    const price = new Amount("0", conversionCurrency);
    const negPos = pos.neg();
    postings.push(
      new Posting(conversionAccount, negPos.units, negPos.cost, price),
    );
  });

  const newEntries = [...entries];
  newEntries.splice(index, 0, conversionEntry);
  return newEntries;
}
