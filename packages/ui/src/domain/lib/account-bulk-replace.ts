import {
  Balance,
  Close,
  Open,
  Pad,
  Transaction,
  type DirectiveBase,
} from "@beancount-js/beancount";
import type { JournalRecord } from "../components/journal-table/model";

export type AccountReplacePatch = {
  path: string;
  from: number;
  to: number;
  original: string;
  next: string;
  recordKey: string;
};

/** Unique accounts referenced by the selected journal records. */
export function accountsInRecords(records: readonly JournalRecord[]): string[] {
  const accounts = new Set<string>();
  for (const record of records) {
    for (const account of record.directive.accounts) {
      if (account) accounts.add(account);
    }
  }
  return [...accounts].sort((a, b) => a.localeCompare(b));
}

function serializeDirective(
  directive: DirectiveBase,
  original: string,
): string {
  let next = directive.toString();
  if (original.endsWith("\n") && !next.endsWith("\n")) {
    next += "\n";
  } else if (!original.endsWith("\n") && next.endsWith("\n")) {
    next = next.slice(0, -1);
  }
  return next;
}

/** Return a rewritten directive, or undefined when From is not present. */
export function replaceAccountInDirective(
  directive: DirectiveBase,
  fromAccount: string,
  toAccount: string,
): DirectiveBase | undefined {
  if (!fromAccount || !toAccount || fromAccount === toAccount) {
    return undefined;
  }

  if (directive instanceof Transaction) {
    let changed = false;
    const postings = directive.postings.map((posting) => {
      if (posting.account !== fromAccount) return posting;
      changed = true;
      return posting.copy({ account: toAccount });
    });
    return changed ? directive.copy({ postings }) : undefined;
  }

  if (directive instanceof Open) {
    if (directive.account !== fromAccount) return undefined;
    return new Open(
      directive.date,
      toAccount,
      directive.currencies,
      directive.booking,
      directive.meta,
    );
  }

  if (directive instanceof Close) {
    if (directive.account !== fromAccount) return undefined;
    return new Close(directive.date, toAccount, directive.meta);
  }

  if (directive instanceof Balance) {
    if (directive.account !== fromAccount) return undefined;
    return directive.copy({ account: toAccount });
  }

  if (directive instanceof Pad) {
    const account =
      directive.account === fromAccount ? toAccount : directive.account;
    const sourceAccount =
      directive.sourceAccount === fromAccount
        ? toAccount
        : directive.sourceAccount;
    if (
      account === directive.account &&
      sourceAccount === directive.sourceAccount
    ) {
      return undefined;
    }
    return new Pad(directive.date, account, sourceAccount, directive.meta);
  }

  return undefined;
}

/**
 * Build file patches for selected records. Skips records without an editable
 * source attachment or without a matching From account.
 */
export function buildAccountReplacePatches(
  records: readonly JournalRecord[],
  fromAccount: string,
  toAccount: string,
): {
  patches: AccountReplacePatch[];
  skipped: string[];
  changedCount: number;
} {
  const patches: AccountReplacePatch[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();

  for (const record of records) {
    const rewritten = replaceAccountInDirective(
      record.directive,
      fromAccount,
      toAccount,
    );
    if (!rewritten) {
      skipped.push(record.key);
      continue;
    }

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
      next: serializeDirective(rewritten, entry.content),
      recordKey: record.key,
    });
  }

  return {
    patches,
    skipped,
    changedCount: patches.length,
  };
}

/** Apply patches to one file's contents (end → start so offsets stay valid). */
export function applyPatchesToContents(
  contents: string,
  patches: readonly AccountReplacePatch[],
): string {
  const sorted = [...patches].sort((a, b) => b.from - a.from);
  let next = contents;
  for (const patch of sorted) {
    if (next.slice(patch.from, patch.to) !== patch.original) {
      throw new Error(
        "A selected record changed in another editor. Reload before applying.",
      );
    }
    next = `${next.slice(0, patch.from)}${patch.next}${next.slice(patch.to)}`;
  }
  return next;
}

export function groupPatchesByPath(
  patches: readonly AccountReplacePatch[],
): Map<string, AccountReplacePatch[]> {
  const byPath = new Map<string, AccountReplacePatch[]>();
  for (const patch of patches) {
    const list = byPath.get(patch.path) ?? [];
    list.push(patch);
    byPath.set(patch.path, list);
  }
  return byPath;
}
