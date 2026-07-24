import type { EditorView } from "@codemirror/view";
import { parseDocument } from "yaml";

export function format(editor: EditorView) {
  const data = editor.state.doc.toString();
  const doc = parseDocument(data);
  if (doc.errors.length) {
    return;
  }
  const formatted = doc.toString();
  if (formatted === data) {
    return;
  }

  const cursorPos = editor.state.selection.ranges[0].from;

  editor.dispatch({
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: formatted,
    },
    selection: {
      anchor: cursorPos,
      head: cursorPos,
    },
  });
}
