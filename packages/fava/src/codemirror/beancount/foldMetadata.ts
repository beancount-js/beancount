import {
  ensureSyntaxTree,
  foldEffect,
  foldService,
  foldable,
  syntaxTree,
} from "@codemirror/language";
import type { EditorState, StateEffect } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { NodeIterator } from "@lezer/common";

export const metadataFolding = foldService.of((state, lineStart, lineEnd) => {
  const tree = syntaxTree(state);
  if (tree.length < lineEnd) return null;

  for (
    let stack: NodeIterator | null = tree.resolveStack(lineEnd, 1);
    stack;
    stack = stack.next
  ) {
    const metadata = stack.node;
    if (metadata.name !== "Metadata") continue;

    const first = metadata.firstChild;
    const attributeName = first?.getChild("AttributeName");
    if (
      !attributeName ||
      !first?.nextSibling ||
      state.doc.lineAt(first.from).from !== lineStart
    ) {
      return null;
    }

    const endsWithNewline =
      metadata.to > metadata.from &&
      state.doc.sliceString(metadata.to - 1, metadata.to) === "\n";
    return {
      from: attributeName.to,
      to: endsWithNewline ? metadata.to - 1 : metadata.to,
    };
  }

  return null;
});

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

/** Collapse metadata blocks from the first attribute's colon. */
export function foldMetadata(view: EditorView) {
  const effects = metadataFoldEffects(view.state);
  if (effects.length) view.dispatch({ effects });
}
