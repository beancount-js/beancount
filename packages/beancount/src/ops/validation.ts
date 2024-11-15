import { BeancountOptions } from "../core";
import {
  type Account,
  Balance,
  Close,
  Commodity,
  type Directives,
  filterTransactions,
  Note,
  Open,
  Directive,
  Document,
  isDirective,
} from "../core/data";
import { computeResidual, inferTolerances } from "../core/interpolate";
import { LedgerError } from "../parser/loader";

export class ValidationError extends Error implements LedgerError {
  readonly context: Record<string, unknown>;
  constructor(message: string, context: Record<string, unknown> | Directive) {
    super(message);
    this.context = isDirective(context) ? { directive: context } : context;
  }

  with(attributes: Record<string, unknown>) {
    for (const [key, value] of Object.entries(attributes)) {
      this.context[key] = value;
    }
    return this;
  }
}

/**
 * Directive types that should be allowed after the account is closed.
 *
 * - Balance directives may be useful to ensure the closed account is empty. A
 *   balance may be sent as part of a statement that is at a date later than
 *   that at which the closing occurred.
 * - Documents may be received well after account closure, and we want to be able
 *   at their issuance dates.
 * - Notes may be taken in the future for various reasons to resolve issues after
 *   accounts have been closed.
 */
const ALLOW_AFTER_CLOSE = [Balance, Document, Note];

/**
 * Check constraints on open and close directives themselves.
 *
 *     This method checks two kinds of constraints:
 *
 *     1. An open or a close directive may only show up once for each account. If a
 *        duplicate is detected, an error is generated.
 *
 *     2. Close directives may only appear if an open directive has been seen
 *        previously (chronologically).
 *
 *     3. The date of close directives must be strictly greater than their
 *        corresponding open directive.
 *
 *     Args:
 *       entries: A list of directives.
 *       unused_options_map: An options map.
 *     Returns:
 *       A list of new errors, if any were found.
 *
 * @param entries A list of directives.
 * @param options An options map.
 * @returns
 */
export function validateOpenClose(
  entries: Directives,
  _options?: BeancountOptions,
): Array<ValidationError> {
  const errors: Array<ValidationError> = [];
  const openMap: Record<string, Open> = {};
  const closeMap: Record<string, Close> = {};
  entries.forEach((entry) => {
    if (entry instanceof Open) {
      if (openMap[entry.account]) {
        errors.push(
          new ValidationError(
            `Duplicate open directive for ${entry.account}`,
            entry,
          ),
        );
      } else {
        openMap[entry.account] = entry;
      }
    } else if (entry instanceof Close) {
      if (closeMap[entry.account]) {
        errors.push(
          new ValidationError(
            `Duplicate close directive for ${entry.account}`,
            entry,
          ),
        );
      } else {
        const openEntry = openMap[entry.account];
        if (!openEntry) {
          errors.push(
            new ValidationError(
              `Unopened account ${entry.account} is being closed`,
              entry,
            ),
          );
        } else if (entry.date < openEntry.date) {
          errors.push(
            new ValidationError(
              `Internal error: closing date(${entry.date}) for ${entry.account} appears before opening date(${openEntry.date})`,
              entry,
            ),
          );
        }
        closeMap[entry.account] = entry;
      }
    }
  });

  return errors;
}

/**
 * Check that balance entries occur only once per day.
 *
 *     Because we do not support time, and the declaration order of entries is
 *     meant to be kept irrelevant, two balance entries with different amounts
 *     should not occur in the file. We do allow two identical balance assertions,
 *     however, because this may occur during import.
 *
 * @param entries A list of directives.
 * @param options An options map.
 * @returns A list of new errors, if any were found.
 */
export function validateDuplicateBalances(
  entries: Directives,
  _options?: BeancountOptions,
): Array<ValidationError> {
  const errors: Array<ValidationError> = [];
  const balanceEntries: Record<string, Balance> = {};
  entries.forEach((entry) => {
    if (!(entry instanceof Balance)) {
      return;
    }
    const key = `${entry.account} ${entry.amount.currency} ${entry.date}`;
    const previousEntry = balanceEntries[key];
    if (previousEntry) {
      if (!entry.amount.eq(previousEntry.amount)) {
        errors.push(
          new ValidationError(
            `Duplicate balance assertion with different amounts`,
            entry,
          ),
        );
      }
    }
    balanceEntries[key] = entry;
  });
  return errors;
}

/**
 * Check that commodity entries are unique for each commodity.
 *
 * @param entries A list of directives.
 * @param options An options map.
 * @returns A list of new errors, if any were found.
 */
export function validateDuplicateCommodities(
  entries: Directives,
  _options?: BeancountOptions,
): Array<ValidationError> {
  const errors: Array<ValidationError> = [];
  const commodityEntries: Record<string, Commodity> = {};
  entries.forEach((entry) => {
    if (!(entry instanceof Commodity)) {
      return;
    }
    const key = entry.currency;
    const previousEntry = commodityEntries[key];
    if (previousEntry) {
      errors.push(
        new ValidationError(
          `Duplicate commodity directives for '${key}'`,
          entry,
        ),
      );
    }
    commodityEntries[key] = entry;
  });
  return errors;
}

/**
 * Check that all references to accounts occurs on active accounts.
 *
 * We basically check that references to accounts from all directives other than
 * Open and Close occur at dates the open-close interval of that account. This
 * should be good for all of the directive types where we can extract an account
 * name.
 *
 * Note that this is more strict a check than comparing the dates: we actually
 * check that no references to account are made on the same day before the open
 * directive appears for that account. This is a nice property to have, and is
 * supported by our custom sorting routine that will sort open entries before
 * transaction entries, given the same date.
 *
 * @param entries A list of directives.
 * @param options An options map.
 * @returns A list of new errors, if any were found.
 */
export function validateActiveAccounts(
  entries: Directives,
  _options?: BeancountOptions,
): Array<ValidationError> {
  const errorPairs: Array<{ account: Account; entry: Directive }> = [];
  const errors: Array<ValidationError> = [];
  const activeSet: Set<string> = new Set<string>();
  const openAccounts: Set<string> = new Set<string>();
  entries.forEach((entry) => {
    if (entry instanceof Open) {
      openAccounts.add(entry.account);
      activeSet.add(entry.account);
    } else if (entry instanceof Close) {
      activeSet.delete(entry.account);
    } else {
      entry.accounts.forEach((account) => {
        if (!activeSet.has(account)) {
          // Allow document and note directives that occur after an
          // account is closed.
          if (
            ALLOW_AFTER_CLOSE.some((it) => entry instanceof it) &&
            openAccounts.has(account)
          ) {
            return;
          }
          errorPairs.push({ account, entry });
        }
      });
    }
  });

  errorPairs.forEach((error) => {
    errors.push(
      new ValidationError(
        openAccounts.has(error.account)
          ? `Invalid reference to inactive account '${error.account}'`
          : `Invalid reference to unknown account '${error.account}'`,
        error.entry,
      ),
    );
  });

  return errors;
}

/**
 * Check the currency constraints from account open declarations.
 *
 * Open directives admit an optional list of currencies that specify the only
 * types of commodities that the running inventory for this account may contain.
 * This function checks that all postings are only made in those commodities.
 *
 * @param entries A list of directives.
 * @param options An options map.
 * @returns A list of new errors, if any were found.
 */
export function validateCurrencyConstraints(
  entries: Directives,
  _options?: BeancountOptions,
): Array<ValidationError> {
  const errors: Array<ValidationError> = [];
  const openMap: Record<string, Open> = {};
  entries
    .filter((it) => it instanceof Open)
    .filter((it) => it.currencies.length > 0)
    .reduce((prev, cur) => {
      prev[cur.account] = cur;
      return prev;
    }, openMap);

  filterTransactions(entries).forEach((entry) => {
    entry.postings.forEach((posting) => {
      if (posting.price && posting.cost) {
        if (posting.price.currency !== posting.cost.currency) {
          errors.push(
            new ValidationError(
              `Cost and price currencies must match: ${posting.cost.currency} != ${posting.price.currency}`,
              entry,
            ),
          );
        }
      }
      const currencies = openMap[posting.account]?.currencies;
      if (!currencies) {
        return;
      }

      if (!currencies.some((it) => it === posting.units?.currency)) {
        errors.push(
          new ValidationError(
            `Invalid currency {} for account '${posting.account}'`,
            entry,
          ),
        );
      }
    });
  });
  return errors;
}

/**
 * "Check again that all transaction postings balance, as users may have
 * transformed transactions.
 *
 * @param entries A list of directives.
 * @param options An options map.
 * @returns A list of new errors, if any were found.
 */
export function validateCheckTransactionBalances(
  entries: Directives,
  options: BeancountOptions,
): Array<ValidationError> {
  const errors: Array<ValidationError> = [];
  filterTransactions(entries).forEach((entry) => {
    const residual = computeResidual(entry.postings);
    const tolerances = inferTolerances(entry.postings, options, true);

    if (!residual.isSmall(tolerances)) {
      errors.push(
        new ValidationError(`Transaction does not balance: ${residual}`, entry),
      );
    }
  });
  return errors;
}

export type Validator = (
  entries: Directives,
  options: BeancountOptions,
) => Array<ValidationError>;

// A list of reasonably fast validations to always run by default.
export const BASIC_VALIDATIONS: Array<Validator> = [
  validateOpenClose,
  validateActiveAccounts,
  validateCurrencyConstraints,
  validateDuplicateBalances,
  validateDuplicateCommodities,
  validateCheckTransactionBalances,
];

// The list of validations to run.
export const VALIDATIONS = BASIC_VALIDATIONS;

export function validate(
  entries: Directives,
  options: BeancountOptions,
  ...extraValidations: Array<Validator>
) {
  const validators: Array<Validator> = [...VALIDATIONS, ...extraValidations];
  const errors: Array<ValidationError> = [];
  validators.forEach((validator) => {
    const newErrors = validator(entries, options);
    errors.push(...newErrors);
  });
  return errors;
}
