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

interface HyperLinkProps {
  at: number;
  url: string;
}

class HyperLink extends WidgetType {
  constructor(readonly state: HyperLinkProps) {
    super();
  }

  eq(other: unknown) {
    return (
      other instanceof HyperLink &&
      this.state.url === other.state.url &&
      this.state.at === other.state.at
    );
  }

  toDOM(_view: EditorView) {
    const span = document.createElement("span");
    span.spellcheck = false;
    span.className = "cm-url";
    const href = document.createElement("a");
    href.href = this.state.url;
    href.className = "cm-underline";
    href.target = "_blank";
    href.innerHTML = this.state.url;
    href.className = "cm-url";
    href.rel = "nofollow";
    span.appendChild(href);
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

const linkDecorator = new MatchDecorator({
  regexp: /https?:\/\/[a-z0-9._/~%\-+&#?!=()@]*/gi,
  decorate: (add, from, to, match) => {
    const url = match[0];
    const start = from,
      end = to;
    add(
      start,
      end,
      Decoration.replace({ widget: new HyperLink({ at: start, url }) }),
    );
  },
});

class URLView implements PluginValue {
  decorator: MatchDecorator;
  linkDecorations: RangeSet<Decoration>;

  constructor(readonly view: EditorView) {
    this.decorator = linkDecorator;
    this.linkDecorations = this.decorator.createDeco(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.linkDecorations = this.decorator.updateDeco(
        update,
        this.decorations,
      );
    }
  }

  get decorations(): RangeSet<Decoration> {
    const current: Range<Decoration>[] = [];
    const deco = this.linkDecorations.update({
      filter: (from, to) => {
        if (isActiveLine(this.view, from)) {
          current.push(Decoration.mark({ class: "cm-url" }).range(from, to));
          return false;
        }
        return true;
      },
    });

    return deco.update({ add: current });
  }
}

const pluginSpec: PluginSpec<URLView> = {
  decorations: (value: URLView) => {
    return value.decorations;
  },
};

export function clickableUrls() {
  return ViewPlugin.fromClass(URLView, pluginSpec);
}
