import { DateTime } from "luxon";
import {
  Commodity,
  type Directive,
  type Directives,
  Open,
  Close,
  Transaction,
} from "./data";

/** Return every account referenced by a directive. */
export function getEntryAccounts(entry: Directive): Set<string> {
  return new Set(entry.accounts);
}

/** Return all account names referenced by a sequence of directives. */
export function getAccounts(entries: readonly Directive[]): Set<string> {
  const accounts = new Set<string>();
  for (const entry of entries) {
    getEntryAccounts(entry).forEach((account) => accounts.add(account));
  }
  return accounts;
}

/** Return every distinct hierarchy component appearing in referenced accounts. */
export function getAccountComponents(
  entries: readonly Directive[],
): Set<string> {
  const components = new Set<string>();
  getAccounts(entries).forEach((account) => {
    account.split(":").forEach((component) => components.add(component));
  });
  return components;
}

function tagsOf(entry: Directive): readonly string[] {
  return "tags" in entry && Array.isArray(entry.tags) ? entry.tags : [];
}

function linksOf(entry: Directive): readonly string[] {
  return "links" in entry && Array.isArray(entry.links) ? entry.links : [];
}

/** Return every tag declared on transactions and account directives. */
export function getAllTags(entries: readonly Directive[]): Set<string> {
  const tags = new Set<string>();
  entries.forEach((entry) => tagsOf(entry).forEach((tag) => tags.add(tag)));
  return tags;
}

/** Return every link declared on transactions and account directives. */
export function getAllLinks(entries: readonly Directive[]): Set<string> {
  const links = new Set<string>();
  entries.forEach((entry) => linksOf(entry).forEach((link) => links.add(link)));
  return links;
}

/** Return non-empty transaction payees. */
export function getAllPayees(entries: readonly Directive[]): Set<string> {
  const payees = new Set<string>();
  entries.forEach((entry) => {
    if (entry instanceof Transaction && entry.payee) payees.add(entry.payee);
  });
  return payees;
}

/** Return the calendar years represented by dated directives. */
export function getActiveYears(entries: readonly Directive[]): Set<number> {
  const years = new Set<number>();
  entries.forEach((entry) => {
    if (entry.date) years.add(entry.date.year);
  });
  return years;
}

/** Return the earliest directive date, or null for an empty undated set. */
export function getMinDate(entries: readonly Directive[]): DateTime | null {
  return entries.reduce<DateTime | null>((minimum, entry) => {
    if (!entry.date || (minimum && entry.date >= minimum)) return minimum;
    return entry.date;
  }, null);
}

/** Return the latest directive date, or null for an empty undated set. */
export function getMaxDate(entries: readonly Directive[]): DateTime | null {
  return entries.reduce<DateTime | null>((maximum, entry) => {
    if (!entry.date || (maximum && entry.date <= maximum)) return maximum;
    return entry.date;
  }, null);
}

/** Return the first commodity declaration for every declared currency. */
export function getCommodityDirectives(
  entries: readonly Directive[],
): Map<string, Commodity> {
  const commodities = new Map<string, Commodity>();
  entries.forEach((entry) => {
    if (entry instanceof Commodity && !commodities.has(entry.currency)) {
      commodities.set(entry.currency, entry);
    }
  });
  return commodities;
}

/** Return open and close directives indexed by account. */
export function getOpenClose(
  entries: readonly Directive[],
): Map<string, { open: Open | null; close: Close | null }> {
  const accountEntries = new Map<
    string,
    { open: Open | null; close: Close | null }
  >();
  entries.forEach((entry) => {
    if (!(entry instanceof Open || entry instanceof Close)) return;
    const record = accountEntries.get(entry.account) ?? {
      open: null,
      close: null,
    };
    if (
      entry instanceof Open &&
      (!record.open || entry.date < record.open.date)
    ) {
      record.open = entry;
    }
    if (
      entry instanceof Close &&
      (!record.close || entry.date < record.close.date)
    ) {
      record.close = entry;
    }
    accountEntries.set(entry.account, record);
  });
  return accountEntries;
}

/** Return unique, defined metadata values for a key. */
export function getMetaValues(
  entries: readonly Directive[],
  key: string,
): Set<unknown> {
  const values = new Set<unknown>();
  entries.forEach((entry) => {
    const value = entry.meta[key];
    if (value !== undefined && value !== null) values.add(value);
  });
  return values;
}

export function getAllMetadataValues(
  entries: Directives,
  key: string,
): Set<unknown> {
  return getMetaValues(entries, key);
}
