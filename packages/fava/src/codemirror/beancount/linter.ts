import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNodeRef } from "@lezer/common";
import type { LedgerSource } from "../../core/ledger";

export function beanCountLinter(source: () => LedgerSource) {
  return linter(
    (view: EditorView) => {
      try {
        const errorMap: Record<string, Diagnostic> = {};
        const state = source();
        syntaxTree(view.state).iterate({
          enter: (node: SyntaxNodeRef) => {
            if (node.type.isError) {
              const line = view.state.doc.lineAt(node.from);
              const key = line.number.toString();
              const path = node.node.parent?.toString();
              errorMap[key] = {
                from: node.from,
                to: node.to,
                severity: "error",
                message: path
                  ? `Invalid syntax on: ${path}`
                  : "Invalid ledger syntax",
              };
            }
          },
        });

        const lines: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state.errors.forEach((err: any) => {
          const lineNo = +(err?.source?.lineno || err.line);
          const key = lineNo.toString();
          lines.push(key);
          if (key && errorMap[key]) {
            errorMap[key].message = err.message;
          } else if (err.from && err.to) {
            errorMap[key] = {
              from: err.from,
              to: err.to,
              severity: "error",
              message: err.message,
            };
          } else if (lineNo) {
            const line = view.state.doc.line(lineNo);
            errorMap[key] = {
              from: line.from,
              to: line.to,
              severity: "error",
              message: err.message,
            };
          }
        });
        return Object.keys(errorMap).map((k) => errorMap[k]);
      } catch (e) {
        console.error("Ledger:lint failed to lint input source: ", e);
        return [];
      }
    },
    {
      needsRefresh: () => {
        return source().errors.length > 0;
      },
    },
  );
}
