import {
  ensureSyntaxTree,
  foldEffect,
  foldable,
  syntaxTree,
} from "@codemirror/language";
import type { EditorState, StateEffect } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export function metadataFoldEffects(state: EditorState) {
  const effects: Array<StateEffect<unknown>> = [];
  const tree =
    ensureSyntaxTree(state, state.doc.length, 1_000) ?? syntaxTree(state);

  tree.cursor().iterate((node) => {
    if (node.name !== "Metadata") return;
    const firstAttribute = node.node.getChild("Attribute");
    if (!firstAttribute) return;
    const line = state.doc.lineAt(firstAttribute.from);
    const range = foldable(state, line.from, line.to);
    if (range) effects.push(foldEffect.of(range));
  });

  return effects;
}

/** Collapse metadata blocks after their first visible attribute. */
export function foldMetadata(view: EditorView) {
  const effects = metadataFoldEffects(view.state);
  if (effects.length) view.dispatch({ effects });
}
