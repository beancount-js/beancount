import { parser as grammarParser } from "./syntax.grammar";
import {
  LRLanguage,
  LanguageSupport,
  indentNodeProp,
  foldNodeProp,
} from "@codemirror/language";

import { type SyntaxNode } from "@lezer/common";
import type { ParserConfig } from "@lezer/lr";

export { parser as rawParser } from "./syntax.grammar";

export const parser = grammarParser.configure({
  props: [
    indentNodeProp.add({
      Metadata: (context) => {
        const node = context.node.parent;
        if (node?.name === "Posting") {
          return context.column(node.from) + context.unit;
        }
        return context.unit;
      },
      Posting: (context) => {
        return context.column(context.node.from) + context.unit;
      },
      Transaction: (context) => {
        const node =
          context.node.getChild("Metadata") || context.node.getChild("Posting");
        if (node) {
          return context.column(node.from) || context.unit;
        }
        return context.unit;
      },
    }),
    foldNodeProp.add({
      Comment: (node: SyntaxNode) => {
        let cursor = node.nextSibling;
        let end: SyntaxNode | null = null;

        while (cursor && cursor.type.name === node.type.name) {
          end = cursor;

          cursor = cursor.nextSibling;
        }
        if (end && node.to < end.from) {
          return { from: node.to, to: end.to - 1 };
        }
        return null;
      },
      Transaction: (node: SyntaxNode) => {
        const nodes = node.getChildren("String");
        const el = (node.getChildren("Posting") || [])[0]?.prevSibling;
        const first = el || nodes[1] || nodes[0] || node.firstChild,
          last = node.lastChild;
        return first && first.to < last!.from
          ? {
              from: first.to,
              to: last!.type.isError ? node.to : last!.to - 1,
            }
          : null;
      },
      Posting: (node: SyntaxNode) => {
        const first =
            node.getChild("Number") ||
            node.getChild("AccountName") ||
            node.firstChild,
          last = node.lastChild;
        return first && first.to < last!.from
          ? {
              from: first.to,
              to: last!.type.isError ? node.to : last!.to - 1,
            }
          : null;
      },
      Metadata: (node: SyntaxNode) => {
        const first = node.firstChild;
        const attributeName = first?.getChild("AttributeName");
        // AttributeName includes its colon. Keep the property name visible and
        // collapse its value together with every following metadata property.
        return attributeName && first?.nextSibling
          ? { from: attributeName.to, to: node.to }
          : null;
      },
    }),
  ],
});

export const beancountLanguage = LRLanguage.define({
  name: "beancount",
  parser,
  languageData: {
    commentTokens: { line: ";" },
    indentOnInput: /^\s*(?:[a-zA-Z0-9_-]+\s*:)/,
  },
});

export function beanCount(options: ParserConfig = {}) {
  return new LanguageSupport(beancountLanguage.configure(options));
}
