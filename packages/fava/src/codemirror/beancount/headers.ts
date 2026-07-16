import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type DecorationSet,
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
    span.textContent = this.state.header.substring(this.state.level).trim();
    // Select the heading line without posAtCoords (unstable while replace
    // widgets swap to editable source marks).
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
  const activeLine = view.state.doc.lineAt(view.state.selection.main.head);
  const decorationLine = view.state.doc.lineAt(at);
  return activeLine.number === decorationLine.number;
}

/** Markdown-style headings live on DocumentMarkup lines, not transaction flags. */
function isDocumentMarkupLine(view: EditorView, from: number) {
  let node = syntaxTree(view.state).resolveInner(from, 1);
  while (node) {
    if (node.name === "DocumentMarkup") {
      return true;
    }
    node = node.parent;
  }
  return false;
}

export function headerLevel(line: string, maxDepth = 0) {
  const match = /^#+/.exec(line) || /^\*+/.exec(line);
  return match?.[0]?.length ?? maxDepth;
}

const headerDecorator = new MatchDecorator({
  regexp: /^(#+|\*+)\s+(.*)/g,
  decorate: (add, from, to, match, view) => {
    if (!isDocumentMarkupLine(view, from)) {
      return;
    }
    const header = match[0];
    const level = headerLevel(match[1]);
    const line = view.state.doc.lineAt(from);
    add(
      line.from,
      line.from,
      Decoration.line({
        class: `cm-line HyperMD-header-${level} HyperMD-header`,
      }),
    );
    // Replace the raw `## title` with a widget that omits the marker.
    add(
      from,
      to,
      Decoration.replace({
        widget: new HeaderWidget({ at: from, header, level }),
      }),
    );
  },
});

function buildHeaderDecorations(
  view: EditorView,
  base: DecorationSet,
): DecorationSet {
  const marks: Range<Decoration>[] = [];
  const filtered = base.update({
    filter: (from, to) => {
      // Line decorations are zero-length; always keep them.
      if (to <= from) {
        return true;
      }
      // Active line: drop the replace widget so `##` source is editable.
      if (isActiveLine(view, from)) {
        const level = headerLevel(view.state.sliceDoc(from, to));
        const line = view.state.doc.lineAt(from);
        if (line.to > line.from) {
          marks.push(
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
  return marks.length ? filtered.update({ add: marks }) : filtered;
}

class HeaderView implements PluginValue {
  /** Unfiltered MatchDecorator set (always includes replace widgets). */
  base: DecorationSet;
  decorations: DecorationSet;

  constructor(readonly view: EditorView) {
    this.base = headerDecorator.createDeco(view);
    this.decorations = buildHeaderDecorations(view, this.base);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      // Must pass the unfiltered base set — never the active-line view.
      this.base = headerDecorator.updateDeco(update, this.base);
    }
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildHeaderDecorations(update.view, this.base);
    }
  }
}

const pluginSpec: PluginSpec<HeaderView> = {
  decorations: (value: HeaderView) => value.decorations,
};

export function decorateHeaders() {
  return ViewPlugin.fromClass(HeaderView, pluginSpec);
}
