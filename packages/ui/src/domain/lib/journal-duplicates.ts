import { Transaction, type DirectiveBase } from "@beancount-js/beancount";
import { formatDate, md5 } from "@beancount-js/parser";
import type { JournalRecord } from "../components/journal-table/model";
import type { AccountReplacePatch } from "./account-bulk-replace";

/**
 * Fingerprint for duplicate detection. Prefer meta `raw_fingerprint` when
 * present; otherwise hash date, flag, payee, narration, and sorted posting
 * amount strings.
 */
export function duplicateFingerprint(
  directive: DirectiveBase,
): string | undefined {
  if (!(directive instanceof Transaction)) {
    return undefined;
  }

  const raw = directive.meta["raw_fingerprint"];
  if (typeof raw === "string" && raw.trim()) {
    return `raw:${raw.trim()}`;
  }

  const sortedAmounts = directive.postings
    .map((posting) =>
      posting.units?.isDefined() ? posting.units.toString().trim() : "",
    )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  // Primary "Amount": first sorted posting amount (stable across posting order).
  const amount = sortedAmounts[0] ?? "";

  return `sem:${md5(
    [
      formatDate(directive.date),
      amount,
      directive.flag ?? "",
      directive.payee ?? "",
      directive.narration ?? "",
      ...sortedAmounts,
    ].join("\u0000"),
  )}`;
}

export type DuplicateGroup = {
  fingerprint: string;
  keep: JournalRecord;
  duplicates: JournalRecord[];
};

function compareKeepOrder(a: JournalRecord, b: JournalRecord): number {
  const byDate = a.date.toMillis() - b.date.toMillis();
  if (byDate !== 0) return byDate;
  const byLine = a.directive.lineno - b.directive.lineno;
  if (byLine !== 0) return byLine;
  return a.key.localeCompare(b.key);
}

/** Group selected records that share a fingerprint (size ≥ 2). */
export function findDuplicateGroups(
  records: readonly JournalRecord[],
): DuplicateGroup[] {
  const byFingerprint = new Map<string, JournalRecord[]>();

  for (const record of records) {
    const fingerprint = duplicateFingerprint(record.directive);
    if (!fingerprint) continue;
    const list = byFingerprint.get(fingerprint) ?? [];
    list.push(record);
    byFingerprint.set(fingerprint, list);
  }

  const groups: DuplicateGroup[] = [];
  for (const [fingerprint, members] of byFingerprint) {
    if (members.length < 2) continue;
    const ordered = [...members].sort(compareKeepOrder);
    const [keep, ...duplicates] = ordered;
    if (!keep || !duplicates.length) continue;
    groups.push({ fingerprint, keep, duplicates });
  }

  groups.sort((a, b) => compareKeepOrder(a.keep, b.keep));
  return groups;
}

/**
 * Build delete patches for every duplicate beyond the kept record in each
 * group. Keeps the earliest record (date, then lineno, then key).
 */
export function buildDuplicateDeletePatches(
  records: readonly JournalRecord[],
): {
  groups: DuplicateGroup[];
  patches: AccountReplacePatch[];
  deleteCount: number;
  keepCount: number;
  skipped: string[];
} {
  const groups = findDuplicateGroups(records);
  const patches: AccountReplacePatch[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const record of group.duplicates) {
      const entry = record.directive.source;
      const path = String(record.directive.meta["filename"] ?? "");
      if (!entry || !path) {
        skipped.push(record.key);
        continue;
      }

      const { from, to } = entry.position;
      const dedupeKey = `${path}:${from}:${to}`;
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      patches.push({
        path,
        from,
        to,
        original: entry.content,
        next: "",
        recordKey: record.key,
      });
    }
  }

  return {
    groups,
    patches,
    deleteCount: patches.length,
    keepCount: groups.length,
    skipped,
  };
}
