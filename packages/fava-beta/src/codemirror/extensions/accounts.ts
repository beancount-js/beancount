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

const accountDecorator = new MatchDecorator({
  regexp: /(([A-Z][A-Za-z0-9_-]+:)+([A-Z][A-Za-z0-9_-]+))/gi,
  decorate: (add, _from, to, match) => {
    const start = to - match[1].length,
      end = to;

    if (end > start) {
      add(
        start,
        end,
        Decoration.mark({
          class: "cm-keyword",
        }),
      );
    }
  },
});

class AccountView implements PluginValue {
  decorator: MatchDecorator;
  linkDecorations: RangeSet<Decoration>;

  constructor(readonly view: EditorView) {
    this.decorator = accountDecorator;
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

const pluginSpec: PluginSpec<AccountView> = {
  decorations: (value: AccountView) => {
    return value.decorations;
  },
};

export const accounts = ViewPlugin.fromClass(AccountView, pluginSpec);
