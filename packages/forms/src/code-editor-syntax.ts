import { syntaxTree } from "@codemirror/language";
import type { Diagnostic } from "@codemirror/lint";
import type { EditorState } from "@codemirror/state";

/** Report parser error nodes without evaluating editor contents. */
export function parserDiagnostics(state: EditorState): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      if (!node.type.isError) return;
      diagnostics.push({
        from: node.from,
        to: Math.max(node.from + 1, node.to),
        severity: "error",
        message: "Syntax error",
      });
    },
  });
  return diagnostics;
}
