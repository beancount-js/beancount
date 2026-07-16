import { syntaxTree } from "@codemirror/language";
import { RangeSet, Range } from "@codemirror/state";
import { type SyntaxNode } from "@lezer/common";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type PluginSpec,
  type PluginValue,
} from "@codemirror/view";
import { numberWithCommas } from "./format";
import { NumberExpression } from "@beancount-js/parser";

interface HashTagProps {
  from: number;
  to: number;
  expr: NumberExpression;
  text: string;
}

class MathTag extends WidgetType {
  constructor(readonly state: HashTagProps) {
    super();
  }

  eq(other: unknown) {
    return (
      other instanceof MathTag &&
      this.state.text === other.state.text &&
      this.state.from === other.state.from
    );
  }

  toDOM(view: EditorView) {
    const value: string = numberWithCommas(
      this.state.expr.resolve().toString(),
    ).toString();
    const span = document.createElement("span");

    span.className = "cm-math-expr";
    span.innerHTML = `
			<button class="clickable-icon" aria-label="Calculate Expression${
        value ? " = " + value : ""
      }" data-tooltip-position="top">
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calculator">
					<rect width="16" height="20" x="4" y="2" rx="2"/>
					<line x1="8" x2="16" y1="6" y2="6"/>
					<line x1="16" x2="16" y1="14" y2="18"/>
					<path d="M16 10h.01"/>
					<path d="M12 10h.01"/>
					<path d="M8 10h.01"/>
					<path d="M12 14h.01"/>
					<path d="M8 14h.01"/>
					<path d="M12 18h.01"/>
					<path d="M8 18h.01"/>
				</svg>
			</button>
		`;
    const button = span.querySelector("button");
    if (button) {
      button.addEventListener("click", () => {
        view.dispatch({
          changes: [
            {
              from: this.state.from,
              to: this.state.to,
              insert: value,
            },
          ],
        });
      });
    }
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

function hasMultipleNumbers(node: SyntaxNode) {
  let count = 0;
  node
    .toTree()
    .cursor()
    .iterate((node) => {
      if (count > 1) {
        return;
      }
      if (node.name === "Number") {
        count++;
      }
    });

  return count > 1;
}

class MathExprView implements PluginValue {
  mathDecorations: Array<Range<Decoration>> = [];

  constructor(readonly view: EditorView) {}

  private numberExpression(node: SyntaxNode): NumberExpression {
    const number = node.getChild("Number");
    const op =
      node.getChild("PLUS") ||
      node.getChild("MINUS") ||
      node.getChild("ASTERISK") ||
      node.getChild("SLASH");
    const operands = node.getChildren("NumberExpr") || [];
    if (number) {
      return new NumberExpression(this.content(number));
    }
    return new NumberExpression(
      operands.map((it) => this.numberExpression(it)!),
      op ? this.content(op) : "",
    );
  }

  private content(node: SyntaxNode | null | undefined) {
    if (!node) {
      return "";
    }
    return this.view.state.sliceDoc(node.from, node.to);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.mathDecorations = [];
      syntaxTree(update.state)
        .cursor()
        .iterate((node) => {
          if (
            node.name === "NumberExpr" &&
            node.node.parent?.name !== "NumberExpr" &&
            hasMultipleNumbers(node.node)
          ) {
            const text = update.state.sliceDoc(node.from, node.to);
            const expr = this.numberExpression(node.node);
            const widget = Decoration.widget({
              widget: new MathTag({ from: node.from, to: node.to, expr, text }),
            });
            this.mathDecorations.push(widget.range(node.from));
          }
        });
    }
  }

  get decorations(): RangeSet<Decoration> {
    return Decoration.set(this.mathDecorations);
  }
}

const pluginSpec: PluginSpec<MathExprView> = {
  decorations: (value: MathExprView) => {
    return value.decorations;
  },
};

export function mathExpressions() {
  return ViewPlugin.fromClass(MathExprView, pluginSpec);
}
