/* eslint-disable prefer-const */
import {
  EditorView,
  getPanel,
  showPanel,
  type Command,
  type Panel,
} from "@codemirror/view";
import GoToLine from "./search/GoToLine.svelte";
import { EditorSelection, StateEffect, StateField } from "@codemirror/state";
import { mount, unmount } from "svelte";

class GoToPanel implements Panel {
  component: GoToLine;
  readonly dom: HTMLElement;

  constructor(readonly view: EditorView) {
    this.dom = document.createElement("div");
    this.component = mount(GoToLine, {
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
    return false;
  }
}

function creategotoLinePanel(view: EditorView) {
  return new GoToPanel(view);
}

export const dialogEffect = StateEffect.define<boolean>();

const dialogField = StateField.define({
  create: () => true,
  update(value, transaction) {
    for (let e of transaction.effects) {
      if (e.is(dialogEffect)) {
        value = e.value;
      }
    }

    return value;
  },
  provide: (f) =>
    showPanel.from(f, (on) => {
      return on ? creategotoLinePanel : null;
    }),
});

export const showGotoLine: Command = (view) => {
  let panel = getPanel(view, creategotoLinePanel);
  if (!panel) {
    const effects: StateEffect<unknown>[] = [dialogEffect.of(true)];
    if (view.state.field(dialogField, false) == null) {
      effects.push(StateEffect.appendConfig.of([dialogField]));
    }
    view.dispatch({ effects });
    panel = getPanel(view, creategotoLinePanel);
  }
  if (panel) {
    const input = panel.dom.querySelector("input")!;
    input.select();
    input.focus();
    setTimeout(() => {
      input.select();
      input.focus();
    });
  }
  return true;
};

export const goToLine = (view: EditorView, value: string) => {
  const match = /^([+-])?(\d+)?(:\d+)?(%)?$/.exec(value);
  if (!match) return;
  let { state } = view,
    startLine = state.doc.lineAt(state.selection.main.head);
  let [, sign, ln, cl, percent] = match;
  let col = cl ? +cl.slice(1) : 0;
  let line = ln ? +ln : startLine.number;
  if (ln && percent) {
    let pc = line / 100;
    if (sign)
      pc = pc * (sign == "-" ? -1 : 1) + startLine.number / state.doc.lines;
    line = Math.round(state.doc.lines * pc);
  } else if (ln && sign) {
    line = line * (sign == "-" ? -1 : 1) + startLine.number;
  }
  const docLine = state.doc.line(Math.max(1, Math.min(state.doc.lines, line)));
  const selection = EditorSelection.cursor(
    docLine.from + Math.max(0, Math.min(col, docLine.length)),
  );
  view.dispatch({
    effects: [
      dialogEffect.of(false),
      EditorView.scrollIntoView(selection.from, { y: "center" }),
    ],
    selection,
  });
  view.focus();
};

export const closeGotoLine: Command = (view) => {
  const effects: StateEffect<unknown>[] = [dialogEffect.of(false)];
  view.dispatch({ effects });
  return true;
};
