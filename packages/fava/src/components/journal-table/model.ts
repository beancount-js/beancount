import {
  Balance,
  Close,
  Custom,
  DirectiveBase,
  Open,
  Pad,
  Query,
  Transaction,
  type Amount,
  type Posting,
} from "@beancount-js/beancount";
import { formatDate } from "@beancount-js/parser";
import type { DateTime } from "luxon";

export type JournalRecord = {
  key: string;
  directive: DirectiveBase;
  date: DateTime;
  dateKey: string;
  title: string;
  detail: string;
  type: string;
  posting?: Posting;
  counterpart?: string;
  postings?: JournalPosting[];
};

export type JournalPosting = {
  account: string;
  amount?: Amount;
};

export type JournalBalance = {
  start: Record<string, number>;
  change: Record<string, number>;
  final: Record<string, number>;
};

export type JournalDateGroup = {
  key: string;
  date: DateTime;
  records: JournalRecord[];
  balance: JournalBalance;
};

const DEFAULT_BALANCE_SHEET_ROOTS = ["Assets", "Liabilities"];

function cloneBalance(value: Record<string, number> | undefined) {
  return { ...(value ?? {}) };
}

function balanceDifference(
  start: Record<string, number>,
  final: Record<string, number>,
) {
  const change: Record<string, number> = {};
  for (const currency of new Set([
    ...Object.keys(start),
    ...Object.keys(final),
  ])) {
    const value = (final[currency] ?? 0) - (start[currency] ?? 0);
    if (value !== 0) change[currency] = value;
  }
  return change;
}

function sourcePositionKey(directive: DirectiveBase) {
  const source = directive.source;
  const filename = String(directive.meta["filename"] ?? "");
  if (source && filename) {
    return `${filename}:${source.position.from}:${source.position.to}`;
  }
  return directive.id;
}

function isBalanceSheetPosting(posting: Posting, roots: readonly string[]) {
  return roots.some(
    (root) =>
      posting.account === root || posting.account.startsWith(`${root}:`),
  );
}

function transactionRecord(
  transaction: Transaction,
  balanceSheetRoots: readonly string[],
): Omit<JournalRecord, "key" | "date" | "dateKey"> {
  const posting =
    transaction.postings.find(
      (item) =>
        isBalanceSheetPosting(item, balanceSheetRoots) &&
        item.units?.isDefined(),
    ) ?? transaction.postings.find((item) => item.units?.isDefined());
  const counterpart = transaction.postings.find(
    (item) => item !== posting,
  )?.account;
  const postings = transaction.postings.map((item) => ({
    account: item.account,
    amount: item.units?.isDefined() ? item.units : undefined,
  }));
  const missingAmount = postings.filter((item) => !item.amount);
  const definedAmount = postings.filter((item) => item.amount);
  if (
    postings.length === 2 &&
    missingAmount.length === 1 &&
    definedAmount.length === 1
  ) {
    missingAmount[0]!.amount = definedAmount[0]!.amount!.neg();
  }
  const title = transaction.payee || transaction.narration || "Transaction";
  const detail = [transaction.payee, transaction.narration]
    .filter(
      (value, index, values) =>
        Boolean(value) && values.indexOf(value) === index,
    )
    .join(" · ");

  return {
    directive: transaction,
    title,
    detail:
      detail || transaction.postings.map((item) => item.account).join(" · "),
    type: transaction.flag || "Transaction",
    posting,
    counterpart,
    postings,
  };
}

function directiveRecord(
  directive: DirectiveBase,
): Omit<JournalRecord, "key" | "date" | "dateKey"> {
  if (directive instanceof Open || directive instanceof Close) {
    return {
      directive,
      title: directive.account,
      detail:
        directive.directiveType === "open" ? "Open account" : "Close account",
      type: directive.directiveType,
    };
  }
  if (directive instanceof Pad) {
    return {
      directive,
      title: directive.account,
      detail: `Pad from ${directive.sourceAccount}`,
      type: directive.directiveType,
    };
  }
  if (directive instanceof Balance) {
    return {
      directive,
      title: directive.account,
      detail: "Balance assertion",
      type: directive.directiveType,
      posting: {
        account: directive.account,
        units: directive.amount,
        cost: null,
        price: null,
      } as Posting,
      postings: [{ account: directive.account, amount: directive.amount }],
    };
  }
  if (directive instanceof Query) {
    return {
      directive,
      title: directive.name,
      detail: directive.query,
      type: directive.directiveType,
    };
  }
  if (directive instanceof Custom) {
    return {
      directive,
      title: directive.type,
      detail: directive.values
        .map((value) => value?.toString() ?? "")
        .join(" "),
      type: directive.directiveType,
    };
  }
  return {
    directive,
    title: directive.directiveType,
    detail: directive.content.split("\n")[0] ?? "",
    type: directive.directiveType,
  };
}

function toRecord(
  directive: DirectiveBase,
  balanceSheetRoots: readonly string[],
): JournalRecord | undefined {
  if (!directive.date) return undefined;
  const date = directive.date;
  const base =
    directive instanceof Transaction
      ? transactionRecord(directive, balanceSheetRoots)
      : directiveRecord(directive);
  return {
    ...base,
    key: sourcePositionKey(directive),
    date,
    dateKey: formatDate(date),
  };
}

/**
 * Return display records for every dated directive supplied by the Journal
 * filter.
 */
export function journalRecords(
  directives: readonly DirectiveBase[],
  balanceSheetRoots: readonly string[] = DEFAULT_BALANCE_SHEET_ROOTS,
) {
  const records: JournalRecord[] = [];
  for (const directive of directives) {
    const record = toRecord(directive, balanceSheetRoots);
    if (record) records.push(record);
  }
  return records;
}

/**
 * Group records descending by day, with balances calculated from the full
 * ledger.
 */
export function groupJournalRecords(
  records: readonly JournalRecord[],
  balancesByDate: Record<string, Record<string, number>>,
) {
  const byDate = new Map<string, JournalRecord[]>();
  for (const record of records) {
    const group = byDate.get(record.dateKey) ?? [];
    group.push(record);
    byDate.set(record.dateKey, group);
  }

  const ascending = [...byDate.entries()]
    .map(([key, group]) => ({ key, date: group[0]!.date, records: group }))
    .sort((left, right) => left.date.toMillis() - right.date.toMillis());
  let previous: Record<string, number> = {};
  const groups = ascending.map(({ key, date, records }) => {
    const final = cloneBalance(balancesByDate[key]);
    const start = cloneBalance(previous);
    previous = final;
    return {
      key,
      date,
      records,
      balance: {
        start,
        change: balanceDifference(start, final),
        final,
      },
    } satisfies JournalDateGroup;
  });
  return groups.reverse();
}

/** Keep date groups intact while targeting a maximum number of records per page. */
export function paginateJournalGroups(
  groups: readonly JournalDateGroup[],
  pageSize: number,
) {
  const pages: JournalDateGroup[][] = [];
  let page: JournalDateGroup[] = [];
  let count = 0;
  for (const group of groups) {
    if (page.length && count + group.records.length > pageSize) {
      pages.push(page);
      page = [];
      count = 0;
    }
    page.push(group);
    count += group.records.length;
  }
  if (page.length) pages.push(page);
  return pages;
}

export function orderedBalanceEntries(
  balance: Record<string, number>,
  operatingCurrencies: readonly string[],
) {
  return Object.entries(balance).sort(([left], [right]) => {
    const leftIndex = operatingCurrencies.indexOf(left);
    const rightIndex = operatingCurrencies.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function postingAmount(record: JournalRecord): Amount | undefined {
  return record.posting?.units ?? undefined;
}
