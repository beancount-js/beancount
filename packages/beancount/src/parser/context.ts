// SPDX-License-Identifier: GPL-2.0-only
// Derived from beancount/parser/context.py at a3cb3fd9f946d6213dd350fb87709a8ef198301d.
// Copyright (C) 2014-2017, 2019-2025 Martin Blais

import { hashEntry } from "../core/compare";
import { findClosestSource, type Directive, Transaction } from "../core/data";
import { getEntryAccounts } from "../core/getters";
import { computeResidual, inferTolerances } from "../core/interpolate";
import { Inventory } from "../core/inventory";
import type { BeancountOptions } from "../core/options";
import { formatEntry } from "./printer";

function addEntryToBalances(
  balances: Map<string, Inventory>,
  entry: Directive,
): void {
  if (!(entry instanceof Transaction)) return;
  for (const posting of entry.postings) {
    const balance = balances.get(posting.account) ?? new Inventory();
    balance.addPosting(posting);
    balances.set(posting.account, balance);
  }
}

function renderBalances(
  balances: ReadonlyMap<string, Inventory>,
  accounts: readonly string[],
): string[] {
  const width = Math.max(1, ...accounts.map((account) => account.length));
  return accounts.flatMap((account) => {
    const positions = balances.get(account)?.positions ?? [];
    if (positions.length === 0) return [`  ${account.padEnd(width)}  `, ""];
    return [
      ...positions.map((position) => `  ${account.padEnd(width)}  ${position}`),
      "",
    ];
  });
}

/**
 * Render bookkeeping context for a directive already loaded by the caller.
 * The optional parsed entry replaces upstream's filesystem reparse and lets a
 * browser client supply the unbooked transaction from its source capability.
 */
export function renderEntryContext(
  entries: readonly Directive[],
  options: BeancountOptions,
  entry: Directive,
  parsedEntry: Directive | null = null,
): string {
  const entryIndex = entries.indexOf(entry);
  if (entryIndex < 0)
    throw new Error("Entry must belong to the loaded entries");

  const accountOrder =
    parsedEntry instanceof Transaction
      ? parsedEntry.postings.map((posting) => posting.account)
      : entry instanceof Transaction
        ? entry.postings.map((posting) => posting.account)
        : [...getEntryAccounts(parsedEntry ?? entry)];
  const accounts = [...new Set(accountOrder)];
  const balances = new Map<string, Inventory>();
  for (const previous of entries.slice(0, entryIndex))
    addEntryToBalances(balances, previous);
  const before = new Map(
    [...balances].map(([account, balance]) => [account, balance.copy()]),
  );
  addEntryToBalances(balances, entry);

  const header = (title: string) =>
    `** ${title} --------------------------------`;
  const lines = [
    header("Transaction Id"),
    "",
    `Hash:${hashEntry(entry)}`,
    `Location: ${entry.meta.filename ?? "<unknown>"}:${entry.meta.lineno ?? 0}`,
    "",
    "",
    header("Balances before transaction"),
    "",
    ...renderBalances(before, accounts),
    header("Transaction"),
    "",
    formatEntry(entry),
    "",
  ];

  if (entry instanceof Transaction) {
    lines.push(header("Residual and Tolerances"), "");
    const residual = computeResidual(entry.postings);
    if (!residual.isEmpty()) lines.push(`Residual: ${residual}`);
    const tolerances = inferTolerances(entry.postings, options);
    if (Object.keys(tolerances).length > 0) {
      lines.push(
        `Tolerances: ${Object.entries(tolerances)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([currency, tolerance]) => `${currency}=${tolerance}`)
          .join(", ")}`,
      );
    }
    lines.push("", "");
  }

  lines.push(
    header("Balances after transaction"),
    "",
    ...renderBalances(balances, accounts),
  );
  return lines.join("\n");
}

/** Render context for the closest source directive without direct filesystem access. */
export function renderFileContext(
  entries: readonly Directive[],
  options: BeancountOptions,
  filename: string,
  lineno: number,
  parsedEntry: Directive | null = null,
): string {
  const entry = findClosestSource(entries, filename, lineno);
  if (!entry)
    throw new Error(`No entry could be found before ${filename}:${lineno}`);
  return renderEntryContext(entries, options, entry, parsedEntry);
}
