import { syntaxTree } from "@codemirror/language";
import { linter, type Diagnostic } from "@codemirror/lint";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNodeRef, Tree } from "@lezer/common";
import { parseLedger } from "@beancount-js/beancount";

import type { Text } from "@codemirror/state";

function treeErrors(tree: Tree, doc: Text): Record<string, Diagnostic> {
  const errorMap: Record<string, Diagnostic> = {};
  tree.iterate({
    enter: (node: SyntaxNodeRef) => {
      if (node.type.isError) {
        const line = doc.lineAt(node.from);
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
  return errorMap;
}

export function beanCountLinter() {
  return linter(
    (view: EditorView) => {
      try {
        const tree = syntaxTree(view.state);
        const parser = parseLedger(view.state.doc.toString(), {
          filename: "",
          attributes: {},
          transform: true,
        });
        const doc = view.state.doc;
        const trueErrors = treeErrors(parser.document.tree, doc);
        const errorMap = treeErrors(tree, doc);
        Object.keys(errorMap)
          .filter((k) => !trueErrors[k])
          .forEach((n) => {
            const line = doc.line(+n);
            view.dispatch(
              {
                changes: {
                  insert: " ",
                  from: line.to,
                },
              },
              {
                changes: {
                  insert: "",
                  from: line.to - 1,
                },
              },
            );
          });

        const lines: string[] = [];
        parser.errors.forEach((err: any) => {
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
      needsRefresh: (update) => {
        return false;
      },
    },
  );
}
