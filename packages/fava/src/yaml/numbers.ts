import type { RangeSet } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  ViewUpdate,
  type PluginSpec,
  type PluginValue,
} from "@codemirror/view";

const numberDecorator = new MatchDecorator({
  regexp: /[:-]\s*((-\s*)?[0-9]+)\s*$/gi,
  decorate: (add, from, to, match, view) => {
    const start = to - match[1].length,
      end = to;

    if (end > start) {
      add(
        start,
        end,
        Decoration.mark({
          class: "cm-number",
        }),
      );
    }
  },
});

class NumberView implements PluginValue {
  decorator: MatchDecorator;
  linkDecorations: RangeSet<Decoration>;

  constructor(readonly view: EditorView) {
    this.decorator = numberDecorator;
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
    return this.linkDecorations;
  }
}

const pluginSpec: PluginSpec<NumberView> = {
  decorations: (value: NumberView) => {
    return value.decorations;
  },
};

export function numbers() {
  return ViewPlugin.fromClass(NumberView, pluginSpec);
}
