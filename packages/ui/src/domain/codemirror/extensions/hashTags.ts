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

const tagDecorator = new MatchDecorator({
  regexp: /(#[a-zA-Z0-9_-]+)/gi,
  decorate: (add, from, to) => {
    const start = from,
      end = to;
    add(
      start,
      start + 1,
      Decoration.mark({
        class:
          "cm-formatting cm-formatting-hashtag cm-hashtag cm-hashtag-begin cm-meta cm-tag-tags",
      }),
    );
    add(
      start + 1,
      end,
      Decoration.mark({
        class: "cm-hashtag cm-hashtag-end cm-meta cm-tag-tags",
      }),
    );
  },
});

class HashTagView implements PluginValue {
  decorator: MatchDecorator;
  linkDecorations: RangeSet<Decoration>;

  constructor(readonly view: EditorView) {
    this.decorator = tagDecorator;
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

const pluginSpec: PluginSpec<HashTagView> = {
  decorations: (value: HashTagView) => {
    return value.decorations;
  },
};

export function hashTags() {
  return ViewPlugin.fromClass(HashTagView, pluginSpec);
}
