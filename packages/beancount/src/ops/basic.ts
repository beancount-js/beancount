import { type Directives, Transaction } from "../core/data";

/** Return transactions carrying a tag, preserving their input order. */
export function filterTag(entries: Directives, tag: string): Transaction[] {
  return entries.filter(
    (entry): entry is Transaction =>
      entry instanceof Transaction && entry.tags.includes(tag),
  );
}

/** Return transactions carrying a link, preserving their input order. */
export function filterLink(entries: Directives, link: string): Transaction[] {
  return entries.filter(
    (entry): entry is Transaction =>
      entry instanceof Transaction && entry.links.includes(link),
  );
}

/** Group transactions under each link they declare. */
export function groupEntriesByLink(
  entries: Directives,
): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>();
  entries.forEach((entry) => {
    if (!(entry instanceof Transaction)) return;
    entry.links.forEach((link) => {
      const group = groups.get(link) ?? [];
      group.push(entry);
      groups.set(link, group);
    });
  });
  return groups;
}

/** Return accounts referenced by every supplied directive. */
export function getCommonAccounts(
  entries: readonly Directives[number][],
): Set<string> {
  if (!entries.length) return new Set();

  const common = new Set(entries[0].accounts);
  for (const entry of entries.slice(1)) {
    for (const account of common) {
      if (!entry.accounts.includes(account)) common.delete(account);
    }
  }
  return common;
}
