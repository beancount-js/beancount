import {
  foldEffect,
  foldService,
  foldable,
  forceParsing,
  syntaxTree,
} from "@codemirror/language";
import type { EditorState, StateEffect, Text } from "@codemirror/state";
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
  const tree = syntaxTree(state);

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

interface MetadataFoldRequest {
  document: Text;
  complete: () => void;
  done: Promise<void>;
}

const metadataFoldRequests = new WeakMap<EditorView, MetadataFoldRequest>();

function scheduleMetadataFold(callback: () => void) {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(callback, { timeout: 100 });
  } else {
    setTimeout(callback, 0);
  }
}

function applyMetadataFolds(view: EditorView) {
  const effects = metadataFoldEffects(view.state);
  if (effects.length) view.dispatch({ effects });
}

/**
 * Collapse metadata blocks from the first attribute's colon after CodeMirror
 * has parsed the complete document. Parsing a large review ledger is
 * incremental, so folding only the initial syntax tree leaves metadata that
 * becomes visible after a long scroll expanded.
 */
export function foldMetadata(view: EditorView): Promise<void> {
  const previous = metadataFoldRequests.get(view);
  if (previous?.document === view.state.doc) return previous.done;

  let complete!: () => void;
  const request: MetadataFoldRequest = {
    document: view.state.doc,
    complete: () => complete(),
    done: new Promise<void>((resolve) => {
      complete = resolve;
    }),
  };
  metadataFoldRequests.set(view, request);

  const run = () => {
    if (
      metadataFoldRequests.get(view) !== request ||
      view.state.doc !== request.document
    ) {
      request.complete();
      return;
    }

    if (!forceParsing(view, request.document.length, 25)) {
      scheduleMetadataFold(run);
      return;
    }

    applyMetadataFolds(view);
    metadataFoldRequests.delete(view);
    request.complete();
  };

  run();
  return request.done;
}
