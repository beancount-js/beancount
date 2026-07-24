import { foldService } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
export function foldComments() {
  return foldService.of((state: EditorState, from: number, to: number) => {
    const foldStart = from;
    let foldEnd = to;
    const line = state.doc.lineAt(from);
    const lines = state.doc.lines;

    if (!line.text.trimStart().startsWith(";")) {
      return null;
    }

    let pos = from - 1;
    let isNested = false;
    while (pos > 0) {
      const prevLine = state.doc.lineAt(pos);
      if (prevLine.text.trim().length == 0) {
        pos--;
        continue;
      }

      if (prevLine.text.trimStart().startsWith(";")) {
        isNested = true;
        break;
      }
      break;
    }

    if (isNested) {
      return null;
    }

    let nextLine = line;
    pos = 0;
    while (nextLine.number < lines) {
      nextLine = state.doc.line(nextLine.number + 1);
      const size = nextLine.text.trim().length;
      if (size > 0 && !nextLine.text.trimStart().startsWith(";")) {
        break;
      }
      foldEnd = nextLine.to;
      if (size > 0) {
        pos++;
      }
    }

    if (
      pos < 2 ||
      state.doc.lineAt(foldStart).number === state.doc.lineAt(foldEnd).number
    ) {
      return null;
    }
    return { from: foldStart, to: foldEnd };
  });
}
