import type { EditorState, TransactionSpec } from "@codemirror/state";
/**
 * Returns a transaction to completely replace the contents of the editor with
 * the given value.
 */
export function replaceContents(
  state: EditorState,
  value: string,
): TransactionSpec {
  if (state.doc.toString() === value) {
    return {};
  }
  return {
    changes: { from: 0, to: state.doc.length, insert: value },
  };
}

/**
 * Returns a transaction to select the line with the given number and scroll it
 * into view.
 */
export function scrollToLine(
  state: EditorState,
  line: number,
): TransactionSpec {
  if (line < 1 || line > state.doc.lines) {
    return {};
  }
  const linePos = state.doc.line(line);
  return {
    selection: { ...linePos, anchor: linePos.from },
    scrollIntoView: true,
  };
}
