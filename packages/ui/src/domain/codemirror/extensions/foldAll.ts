import { foldable, foldEffect, syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";

export function foldAll(view: EditorView) {
  const state = view.state;

  // Traverse the syntax tree and collect all foldable ranges
  const foldRanges: { from: number; to: number }[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      const isFoldable = foldable(state, node.from, node.to);
      if (isFoldable) {
        foldRanges.push({ from: isFoldable.from, to: isFoldable.to });
        return false;
      }
    },
  });

  view.dispatch({
    effects: foldRanges.map((range) =>
      foldEffect.of({ from: range.from, to: range.to }),
    ),
  });
}
