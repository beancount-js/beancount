import { syntaxTree } from "@codemirror/language";
import type { Range, RangeSet } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type PluginSpec,
  type PluginValue,
} from "@codemirror/view";

interface HeaderProps {
  at: number;
  header: string;
  level: number;
}

class HeaderWidget extends WidgetType {
  constructor(readonly state: HeaderProps) {
    super();
  }

  eq(other: unknown) {
    return (
      other instanceof HeaderWidget &&
      this.state.header === other.state.header &&
      this.state.at === other.state.at
    );
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = `cm-header cm-header-${this.state.level}`;
    span.innerText = this.state.header.substring(this.state.level).trim();
    // Place the cursor on the heading line without posAtCoords — calling that
    // while replace widgets swap to editable marks can crash CodeMirror's
    // coordinate scan (`child.isText` on undefined).
    span.onclick = () => {
      view.dispatch({ selection: { anchor: this.state.at } });
    };
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

function isActiveLine(view: EditorView, at: number) {
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head),
    decorationLine = view.state.doc.lineAt(at);
  return activeLine.number === decorationLine.number;
}

export function headerLevel(line: string, maxDepth = 0) {
  const match = /^#+/.exec(line) || /^\*+/.exec(line);
  return match?.[0]?.length ?? maxDepth;
}

const headerDecorator = new MatchDecorator({
  regexp: /^(#+|\*+)\s+(.*)/gi,
  decorate: (add, from, to, match, view) => {
    const header = match[0];
    const start = from,
      level = headerLevel(match[1]),
      end = to;
    const line = view.state.doc.lineAt(from);
    const node = syntaxTree(view.state).cursorAt(line.from);
    if (node.name !== "Journal") {
      return;
    }
    add(
      line.from,
      line.from,
      Decoration.line({
        class: `cm-line HyperMD-header-${level} HyperMD-header`,
      }),
    );

    add(
      start,
      end,
      Decoration.replace({
        widget: new HeaderWidget({ at: start, header, level: level }),
      }),
    );
  },
});

class HeaderView implements PluginValue {
  decorator: MatchDecorator;
  headerDecorations: RangeSet<Decoration>;

  constructor(readonly view: EditorView) {
    this.decorator = headerDecorator;
    this.headerDecorations = this.decorator.createDeco(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.headerDecorations = this.decorator.updateDeco(
        update,
        this.decorations,
      );
    }
  }

  get decorations(): RangeSet<Decoration> {
    const current: Range<Decoration>[] = [];
    const deco = this.headerDecorations.update({
      filter: (from, to) => {
        const size = this.view.state.doc.length;
        if (to > from && to <= size && isActiveLine(this.view, from)) {
          const level = headerLevel(this.view.state.sliceDoc(from, to));
          const line = this.view.state.doc.lineAt(from);
          if (line.to > line.from) {
            current.push(
              Decoration.mark({ class: `cm-header cm-header-${level}` }).range(
                line.from,
                line.to,
              ),
            );
          }
          return false;
        }
        return true;
      },
    });
    return deco.update({ add: current });
  }
}

const pluginSpec: PluginSpec<HeaderView> = {
  decorations: (value: HeaderView) => {
    return value.decorations;
  },
};

export function decorateHeaders() {
  return ViewPlugin.fromClass(HeaderView, pluginSpec);
}
