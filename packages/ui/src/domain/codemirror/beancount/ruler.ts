import { syntaxTree } from "@codemirror/language";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import { ViewPlugin } from "@codemirror/view";

export function determineCurrencyColumn(view: EditorView): number {
  let max = 0;
  const state = view.state;
  syntaxTree(state)
    .cursor()
    .iterate((node) => {
      // if (node.node.parent?.parent?.parent?.name !== "Journal") {

      //   console.log("Node", node.node.parent?.parent?.parent?.name)
      //   return;
      // }
      const line = state.doc.lineAt(node.from);
      if (
        node.name === "Currency" &&
        node.node.prevSibling?.name !== "Currency"
      ) {
        const diff = node.from - line.from;
        if (diff > max) {
          max = diff;
        }
      }
    });
  return max;
}

/** This CodeMirror view plugin creates a ruler at (before) the given column. */
export const rulerPlugin = (
  column: (view: EditorView) => number = determineCurrencyColumn,
  delta: number = 0,
): ViewPlugin<{
  update(update: ViewUpdate): void;
  destroy(): void;
}> =>
  ViewPlugin.define((view) => {
    const ruler = view.dom.appendChild(document.createElement("div"));
    ruler.style.position = "absolute";
    ruler.style.borderRight = "1px dotted var(--code-comment)";
    ruler.style.height = "100%";
    ruler.style.opacity = "0.5";
    ruler.style.pointerEvents = "none";

    const updatePosition = () => {
      const firstLine = view.contentDOM.querySelector(".cm-line");
      if (firstLine) {
        const { paddingLeft } = getComputedStyle(firstLine);
        const domRect = view.dom.getBoundingClientRect();
        const contentDOMRect = view.contentDOM.getBoundingClientRect();
        // We need to add the width of the gutter (line numbers etc.) since
        // our ruler is positioned absolutely within the whole editor.
        const gutterWidth = contentDOMRect.x - domRect.x;
        const x = column(view);
        const offset = x * view.defaultCharacterWidth + gutterWidth + delta;
        ruler.style.width = paddingLeft;
        ruler.style.left = `${offset.toString()}px`;
        ruler.style.display = x > 0 ? "block" : "none";
      }
    };

    view.requestMeasure({ read: updatePosition });

    return {
      update(update) {
        if (update.viewportChanged || update.geometryChanged) {
          view.requestMeasure({ read: updatePosition });
        }
      },

      destroy() {
        ruler.remove();
      },
    };
  });
