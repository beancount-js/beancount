import { derived, writable, type Readable, type Writable } from "svelte/store";
import { derivedArray } from "./stores";
import { getContext } from "svelte";
import type { MenuItem } from "./menu";
import {
  type BeancountOptions,
  Conversion,
  DEFAULT_CONVERSION,
  type Directives,
  filterLedger,
  LoadError,
  sorted,
} from "@beancount-js/beancount";
import {
  DEFAULT_INTERVAL,
  Filter,
  parseQuery,
  type Interval,
} from "@beancount-js/filters";
import type { DateTime } from "luxon";
import type { FavaOptions, LedgerOptions } from "./options";
import type { LedgerData, LedgerSource } from "./core/ledger";
import type { AccountDetails } from "./core/account";
export const ContextKey = Symbol("componentContext");

export type Options = Record<string, any> & {
  beancount: BeancountOptions;
  fava: FavaOptions;
  ledger: LedgerOptions;
};

export interface ComponentContext {
  conversion: Writable<Conversion>;
  menu: Writable<Array<Array<MenuItem>>>;
  interval: Writable<Interval>;
  draftDirectives: Writable<Directives>;
  lastActiveChartName: Writable<string | null>;
  ledgerSource: Writable<LedgerSource>;
  query: Writable<string>;
  ledgerOptions: Readable<Options>;
  bqlQuery: Writable<string>;
  predicate: Readable<{
    predicate: Filter | undefined;
    errors: Array<string>;
  }>;
  ledgerData: Readable<LedgerData>;
  accounts: Readable<readonly string[]>;
  currencies: Readable<readonly string[]>;
  operatingCurrency: Readable<readonly string[]>;
  currenciesSorted: Readable<readonly string[]>;
  currencyName: Readable<(currency: string) => string>;
  accountDetails: Readable<Record<string, AccountDetails>>;
  links: Readable<readonly string[]>;
  payees: Readable<readonly string[]>;
  tags: Readable<readonly string[]>;
  years: Readable<readonly string[]>;
  precisions: Readable<Record<string, number>>;
  isClosedAccount: Readable<(name: string, date: DateTime | null) => boolean>;
}

export function useContext(): ComponentContext {
  return getContext<ComponentContext>(ContextKey);
}

export function createContext(): ComponentContext {
  /** The current conversion used for reports. */
  const conversion = writable<Conversion>(DEFAULT_CONVERSION);
  /** The current interval used for reports. */
  const interval = writable<Interval>(DEFAULT_INTERVAL);
  const lastActiveChartName = writable<string | null>(null);
  const draftDirectives = writable<Directives>([]);
  const menu = writable<Array<Array<MenuItem>>>([]);
  const query = writable<string>();
  const bqlQuery = writable<string>();
  const predicate = derived([query], ([$query]) => {
    if (!$query) {
      return { predicate: undefined, errors: [] };
    }
    const [predicate, errors] = parseQuery($query);
    return { predicate, errors };
  });

  const ledgerSource = writable<LedgerSource>();
  const ledgerOptions = derived([ledgerSource], ([$ledgerSource]) => {
    return $ledgerSource.options;
  });

  const ledgerData = derived(
    [ledgerSource, predicate, draftDirectives],
    ([$ledgerSource, $predicate, $draftDirectives]) => {
      let directives = [
        ...$ledgerSource.directives,
        ...($draftDirectives || []),
      ];
      const errors = [...($predicate.errors || [])];
      if ($predicate.predicate) {
        const [filtered, filterErrors] = filterLedger(
          directives,
          $predicate.predicate,
        );
        errors.push(...filterErrors);
        directives = filtered;
      }
      sorted(directives);
      return $ledgerSource.data.copy({
        directives,
        errors: [
          ...$ledgerSource.errors,
          ...errors.map((it) => new LoadError(it)),
        ],
      });
    },
  );

  /** The operating currencies (sorted). */
  const operatingCurrency = derivedArray(ledgerData, ($ledgerData) => {
    const options = $ledgerData.options.beancount.operating_currency || [];
    if (Array.isArray(options)) {
      return [...options].sort();
    }
    return [options];
  });

  /** The ranked array of all accounts. */
  const accounts = derivedArray(ledgerData, (v) => v.accounts);

  /** Get the name (as given per metadata) of a currency. */
  const currencyName = derived(
    ledgerData,
    ({ currencyNames }) =>
      (c: string) =>
        currencyNames[c] ?? c,
  );

  /** Account information. */
  const accountDetails = derived(ledgerData, (v) => v.accountDetails);
  /** The ranked array of all currencies. */
  const currencies = derivedArray(ledgerData, (v) => v.currencies);
  /** The ranked array of all links. */
  const links = derivedArray(ledgerData, (v) => v.links);
  /** The ranked array of all payees. */
  const payees = derivedArray(ledgerData, (v) => v.payees);
  /** The ranked array of all tags. */
  const tags = derivedArray(ledgerData, (v) => v.tags);
  /** The array of all years. */
  const years = derivedArray(ledgerData, (v) => v.years);

  /** The sorted array of all used currencies. */
  const currenciesSorted = derivedArray(currencies, ($currencies) =>
    [...$currencies].sort(),
  );

  const precisions = derived(
    ledgerData,
    ($ledgerData) => $ledgerData.precisions,
  );

  const isClosedAccount = derived(
    [accountDetails],
    ([$accountDetails]) =>
      (name: string, date: DateTime | null) => {
        const closeDate = $accountDetails[name]?.closeDate;
        if (!closeDate) {
          return false;
        }
        return date === null ? true : closeDate.toMillis() < date.toMillis();
      },
  );

  return {
    ledgerOptions,
    menu,
    lastActiveChartName,
    draftDirectives,
    conversion,
    interval,
    query,
    bqlQuery,
    predicate,
    ledgerSource,
    ledgerData,
    accounts,
    currencyName,
    accountDetails,
    currencies,
    operatingCurrency,
    currenciesSorted,
    links,
    payees,
    tags,
    years,
    precisions,
    isClosedAccount,
  };
}
