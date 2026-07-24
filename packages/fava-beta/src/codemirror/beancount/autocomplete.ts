import {
  snippetCompletion,
  type Completion,
  type CompletionResult,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { LedgerSource } from "../../core/ledger";

const undatedDirectives = ["option", "plugin", "include"];
const datedDirectives = [
  "*",
  "open",
  "close",
  "custom",
  "commodity",
  "balance",
  "pad",
  "note",
  "document",
  "price",
  "event",
  "query",
];

/** Get Completion objects from strings. */
const opts = (s: readonly string[]): Completion[] =>
  s.map((label) => ({ label }));

const res = (s: readonly string[], from: number): CompletionResult => ({
  options: opts(s),
  from,
});

export const beancountSnippets: () => readonly Completion[] = () => {
  const today = new Date().toISOString().substring(0, 10);
  return [
    snippetCompletion(
      `${today} #{*} "#{}" "#{}"\n  #{Assets:A}  #{0.00} GBP\n  #{Expenses:B}`,
      {
        label: `${today} * transaction`,
      },
    ),
  ];
};

export function beancountCompletion(source: () => LedgerSource) {
  const beancountCompletion: CompletionSource = (context) => {
    const completions = source().taxonomy;
    const tag = context.matchBefore(/#[A-Za-z0-9\-_/.]*/);
    if (tag) {
      return {
        options: opts(completions.tags),
        from: tag.from + 1,
        validFor: /\S+/,
      };
    }

    const date = context.matchBefore(/\d{4}[./-]\d{2}[./-]\d{2}/);
    if (date) {
      return {
        options: opts(datedDirectives),
        from: date.from + 1,
        validFor: /\S+/,
      };
    }

    const link = context.matchBefore(/\^[A-Za-z0-9\-_/.]*/);
    if (link) {
      return {
        options: opts(completions.links),
        from: link.from + 1,
        validFor: /\S+/,
      };
    }

    const indented = context.matchBefore(/^\s+[A-Z]\S*/);
    if (indented) {
      const indentation =
        indented.text.length - indented.text.trimStart().length;
      return {
        options: opts(completions.accounts),
        from: indented.from + indentation,
        validFor: /\S+/,
      };
    }
    const line = context.state.doc.lineAt(context.pos);
    if (context.matchBefore(/\d+/)) {
      return { options: beancountSnippets(), from: line.from };
    }

    const currentWord = context.matchBefore(/\S*/);
    if (currentWord?.from === line.from && line.length > 0) {
      return {
        options: opts(undatedDirectives),
        from: line.from,
        validFor: /\S+/,
      };
    }

    const tree = syntaxTree(context.state);
    const before = tree.resolve(context.pos, -1);
    // Node types of the last 4 nodes.
    const nodeTypesBefore = [
      before.name,
      before.prevSibling?.name,
      before.prevSibling?.prevSibling?.name,
      before.prevSibling?.prevSibling?.prevSibling?.name,
    ];

    type T = string | string[];

    // Check whether the previous nodes (up to 4) match the given types.
    const match = (
      ...types: [T] | [T, T] | [T, T, T] | [T, T, T, T]
    ): boolean =>
      types.every((t, i) => {
        const nodeType = nodeTypesBefore[i];
        return typeof t === "string"
          ? nodeType === t
          : t.some((n) => nodeType === n);
      });

    // complete payee after transaction flag.
    if (match("Flag", "Date")) {
      return res(completions.payees, before.from + 1);
    }

    // complete directive names after a date.
    if (match("JournalItem")) {
      return res(datedDirectives, context.pos);
    }

    if (match(["⚠", "Date"])) {
      return res(datedDirectives, before.from);
    }

    if (
      // account directly after one of these directives:
      match(
        ["⚠", "AccountName"],
        ["BALANCE", "CLOSE", "OPEN", "PAD", "NOTE", "DOCUMENT"],
        "Date",
      ) ||
      // padding account
      match(["⚠", "AccountName"], "AccountName", "PAD", "Date")
    ) {
      return res(completions.accounts, before.from);
    }

    if (
      match("Currency") ||
      // complete currencies after a number.
      match("⚠", "Number") ||
      // account currency
      match(["⚠", "Currency"], "AccountName", "OPEN", "Date") ||
      // price or commodity currency
      match(["⚠", "Currency"], ["COMMODITY", "PRICE"], "Date")
    ) {
      return res(completions.currencies, before.from);
    }

    return null;
  };
  return beancountCompletion;
}
