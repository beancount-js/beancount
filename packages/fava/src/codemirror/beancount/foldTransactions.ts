/* eslint-disable prefer-const */
import { foldEffect, syntaxTree, unfoldEffect } from "@codemirror/language";
import type { StateEffect } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";

export function foldTransactions(view: EditorView, collapse: boolean = true) {
  const effects: Array<StateEffect<unknown>> = [];
  syntaxTree(view.state)
    .cursor()
    .iterate((node) => {
      if (
        node.name == "Comment" &&
        node.node.prevSibling?.type.name !== "Comment"
      ) {
        let cursor = node.node.nextSibling;
        let end: SyntaxNodeRef | null = null;

        while (cursor && cursor.type.name === node.type.name) {
          end = cursor;
          cursor = cursor.nextSibling;
        }
        if (end && node.to < end.from) {
          const effect = { from: node.to, to: end.to - 1 };
          effects.push(
            collapse ? foldEffect.of(effect) : unfoldEffect.of(effect),
          );
        }
      } else if (node.name == "Transaction") {
        let first =
            node.node.getChild("Number") ||
            node.node.getChild("AccountName") ||
            node.node.firstChild,
          last = node.node.lastChild;
        const effect =
          first && first.to < last!.from
            ? {
                from: first.to,
                to: last!.type.isError ? node.to : last!.to - 1,
              }
            : null;
        if (effect) {
          effects.push(
            collapse ? foldEffect.of(effect) : unfoldEffect.of(effect),
          );
        }
      }
    });
  view.dispatch({ effects });
}
