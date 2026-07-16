import { EditorView, type Panel } from "@codemirror/view";
import FindReplace from "./FindReplace.svelte";
import { search as editorSearch } from "@codemirror/search";
import type { Extension, SelectionRange, StateEffect } from "@codemirror/state";
import { mount, unmount } from "svelte";

class SearchPanel implements Panel {
  component: ReturnType<
    typeof mount<{ view: EditorView }, Record<string, any>>
  >;
  readonly dom: HTMLElement;

  constructor(readonly view: EditorView) {
    this.dom = document.createElement("div");
    this.component = mount(FindReplace, {
      target: this.dom,
      props: { view },
    });
  }

  mount(): void {
    document
      .querySelector<HTMLInputElement>("input.document-search-input")
      ?.focus();
  }

  destroy(): void {
    unmount(this.component);
  }

  get top() {
    return true;
  }
}

interface SearchConfig {
  /**
   * Whether to position the search panel at the top of the editor (the default
   * is at the bottom).
   */
  top?: boolean;
  /**
   * Whether to enable case sensitivity by default when the search panel is
   * activated (defaults to false).
   */
  caseSensitive?: boolean;
  /** Whether to treat string searches literally by default (defaults to false). */
  literal?: boolean;
  /**
   * Controls whether the default query has by-word matching enabled. Defaults
   * to false.
   */
  wholeWord?: boolean;
  /**
   * Used to turn on regular expression search in the default query. Defaults to
   * false.
   */
  regexp?: boolean;
  /**
   * By default, matches are scrolled into view using the default behavior of
   * [`EditorView.scrollIntoView`](https://codemirror.net/6/docs/ref/#view.EditorView^scrollIntoView).
   * This option allows you to pass a custom function to produce the scroll
   * effect.
   */
  scrollToMatch?: (
    range: SelectionRange,
    view: EditorView,
  ) => StateEffect<unknown>;
}

export function search(config?: SearchConfig): Extension {
  const cfg: SearchConfig = {
    top: true,
    caseSensitive: false,
    literal: false,
    wholeWord: false,
    regexp: false,
    scrollToMatch: (range) => EditorView.scrollIntoView(range),
  };
  return editorSearch({
    ...cfg,
    createPanel: (view) => {
      return new SearchPanel(view);
    },
  });
}
