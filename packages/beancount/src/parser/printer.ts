// SPDX-License-Identifier: GPL-2.0-only
// Derived from beancount/parser/printer.py at a3cb3fd9f946d6213dd350fb87709a8ef198301d.
// Copyright (C) 2014-2026 Martin Blais

import { type Metadata, DirectiveBase } from "../core/data";

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

/** Render one local directive using its parser-accepted source representation. */
export function formatEntry(
  entry: DirectiveBase,
  prefix = "",
  writeSource = false,
): string {
  const source = writeSource ? `; source: ${renderSource(entry.meta)}\n` : "";
  return `${source}${prefix}${entry.toString()}`;
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
