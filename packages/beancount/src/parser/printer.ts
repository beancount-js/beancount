// SPDX-License-Identifier: GPL-2.0-only
// Derived from beancount/parser/printer.py at a3cb3fd9f946d6213dd350fb87709a8ef198301d.
// Copyright (C) 2014-2026 Martin Blais

import { getWeight } from "../core/convert";
import {
  Balance,
  type Metadata,
  Booking,
  DirectiveBase,
  Open,
  Note,
  Pad,
  Posting,
  Price,
  Transaction,
  writeScalar,
} from "../core/data";
import { hasNonTrivialBalance } from "../core/interpolate";

export interface PrintableError {
  message: string;
  source?: Metadata;
  entry?: DirectiveBase | ReadonlyArray<DirectiveBase> | null;
}

/** Align rendered positions at their first uppercase currency character. */
export function alignPositionStrings(
  strings: ReadonlyArray<string>,
): [string[], number] {
  let maxBefore = 0;
  let maxAfter = 0;
  let maxUnknown = 0;
  const items: Array<[number | null, string]> = [];

  for (const string of strings) {
    const index = string.search(/[A-Z]/);
    if (index > 0) {
      maxBefore = Math.max(index, maxBefore);
      maxAfter = Math.max(string.length - index, maxAfter);
      items.push([index, string]);
    } else {
      maxUnknown = Math.max(string.length, maxUnknown);
      items.push([null, string]);
    }
  }

  const width = Math.max(maxBefore + maxAfter, maxUnknown);
  const afterWidth = width - maxBefore;
  return [
    items.map(([index, string]) =>
      index === null
        ? string.padEnd(width)
        : string.slice(0, index).padStart(maxBefore) +
          string.slice(index).padEnd(afterWidth),
    ),
    width,
  ];
}

export function renderSource(meta: Metadata): string {
  return `${meta.filename ?? "<unknown>"}:${meta.lineno ?? 0}:`;
}

export function renderFlag(flag: string | null | undefined): string {
  return flag ?? "";
}

/** Render the account, position, and accounting weight of one posting. */
export function renderPostingStrings(
  posting: Posting,
): [string, string, string] {
  const flagAccount = posting.flag
    ? `${renderFlag(posting.flag)} ${posting.account}`
    : posting.account;
  if (!posting.units?.isDefined()) return [flagAccount, "", ""];
  const cost = (posting.cost?.toString(true) ?? "")
    .replace(/^\{\s*/, "{")
    .replace(/\s*\}$/, "}");
  const price = posting.price ? ` @ ${writeScalar(posting.price)}` : "";
  const position = `${posting.units}${cost ? ` ${cost}` : ""}${price}`;
  return [flagAccount, position, getWeight(posting).toString()];
}

/** Render a transaction with upstream-compatible aligned postings and weights. */
export function formatTransaction(
  transaction: Transaction,
  renderWeights = false,
): string {
  const description = [
    transaction.payee && writeScalar(transaction.payee),
    transaction.narration && writeScalar(transaction.narration),
    ...[...transaction.tags].sort().map((tag) => `#${tag}`),
    ...[...transaction.links].sort().map((link) => `^${link}`),
  ]
    .filter(Boolean)
    .join(" ");
  const rows = transaction.postings.map(renderPostingStrings);
  const accountWidth = Math.max(1, ...rows.map(([account]) => account.length));
  const [positions, positionWidth] = alignPositionStrings(
    rows.map(([, position]) => position),
  );
  const [weights, weightWidth] = alignPositionStrings(
    rows.map(([, , weight]) => weight),
  );
  const header =
    `${transaction.date.toISODate()} ${renderFlag(transaction.flag)} ${description}`.trimEnd();
  const includeWeights =
    renderWeights && transaction.postings.some(hasNonTrivialBalance);
  const postings = rows.map(([account], index) => {
    const line = `  ${account.padEnd(accountWidth)}  ${positions[index].padEnd(Math.max(1, positionWidth))}`;
    return includeWeights
      ? `${line}  ; ${weights[index].padEnd(Math.max(1, weightWidth))}`.trimEnd()
      : line.trimEnd();
  });
  return [header, ...postings].join("\n");
}

function formatOpen(entry: Open): string {
  const booking =
    entry.booking === Booking.STRICT ? "" : ` \"${entry.booking}\"`;
  return `${entry.date.toISODate()} open ${entry.account.padEnd(47)} ${entry.currencies.join(",")}${booking}`.trimEnd();
}

function formatPrice(entry: Price): string {
  return `${entry.date.toISODate()} price ${entry.currency.padEnd(22)} ${entry.amount.toString().padStart(22)}`;
}

function formatBalance(entry: Balance): string {
  return `${entry.date.toISODate()} balance ${entry.account.padEnd(47)} ${entry.amount}`;
}

function formatPad(entry: Pad): string {
  return `${entry.date.toISODate()} pad ${entry.account} ${entry.sourceAccount}`;
}

function formatNote(entry: Note): string {
  const labels = [
    ...[...entry.tags].sort().map((tag) => `#${tag}`),
    ...[...entry.links].sort().map((link) => `^${link}`),
  ];
  return [
    `${entry.date.toISODate()} note ${entry.account} ${writeScalar(entry.comment)}`,
    ...labels,
  ].join(" ");
}

/** Render one local directive using its parser-accepted source representation. */
export function formatEntry(
  entry: DirectiveBase,
  prefix = "",
  writeSource = false,
  renderWeights = false,
): string {
  const source = writeSource ? `; source: ${renderSource(entry.meta)}\n` : "";
  const text =
    entry instanceof Transaction
      ? formatTransaction(entry, renderWeights)
      : entry instanceof Balance
        ? formatBalance(entry)
        : entry instanceof Pad
          ? formatPad(entry)
          : entry instanceof Note
            ? formatNote(entry)
            : entry instanceof Open
              ? formatOpen(entry)
              : entry instanceof Price
                ? formatPrice(entry)
                : entry.toString();
  return `${source}${prefix}${text}`;
}

/** Render a single error without depending on Python-style output streams. */
export function formatError(error: PrintableError): string {
  const header = `${renderSource(error.source ?? {})} ${error.message}\n`;
  if (!error.entry) return header;
  const entries = Array.isArray(error.entry) ? error.entry : [error.entry];
  return `${header}\n${entries.map((entry) => `   ${formatEntry(entry)}`).join("\n")}\n`;
}

/** Render a directive sequence using the upstream block-separation convention. */
export function formatEntries(
  entries: ReadonlyArray<DirectiveBase>,
  prefix = "",
  writeSource = false,
): string {
  let result = prefix;
  let previousType: string | undefined;
  for (const entry of entries) {
    const type = entry.directiveType;
    if (
      type === "transaction" ||
      type === "commodity" ||
      type !== previousType ||
      writeSource
    )
      result += "\n";
    result += formatEntry(entry, prefix, writeSource);
    previousType = type;
  }
  return result;
}
