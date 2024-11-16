import { syntaxTree } from "@codemirror/language";
import { RangeSet, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  type PluginSpec,
  type PluginValue,
} from "@codemirror/view";
import ComboWidgetComponent from "./comboWidget.svelte";
import type { SyntaxNodeRef } from "@lezer/common";

export interface ComboProps {
  from: number;
  to: number;
  account: string;
  nodeName: string;
  props: ComboWidgetProps;
}

class ComboWidget extends WidgetType {
  constructor(readonly state: ComboProps) {
    super();
  }

  eq(other: any) {
    return (
      this.state.account === other.state.account &&
      this.state.nodeName === other.state.nodeName &&
      this.state.from === other.state.from
    );
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    const component = new ComboWidgetComponent({
      target: span,
      props: {
        value: this.state.account,
        accounts: () => this.state.props.data(this.state),
        onValueChange: (value: string) => {
          if (!value) {
            return;
          }
          value = this.state.props.write
            ? this.state.props.write(value)
            : value;
          view.dispatch({
            changes: [
              {
                from: this.state.from,
                to: this.state.to,
                insert: value,
              },
            ],
          });
        },
      },
    });
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

class ComboWidgetView implements PluginValue {
  accountDecorations: Array<Range<Decoration>> = [];

  constructor(
    readonly view: EditorView,
    readonly props: ComboWidgetProps,
  ) {}

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.accountDecorations = [];
      syntaxTree(update.state)
        .cursor()
        .iterate((node) => {
          if (this.props.match(node, update)) {
            const value = update.state.sliceDoc(node.from, node.to);
            const account = this.props.read ? this.props.read(value) : value;
            const widget = Decoration.widget({
              widget: new ComboWidget({
                from: node.from,
                to: node.to,
                account,
                props: this.props,
                nodeName: node.name,
              }),
            });
            this.accountDecorations.push(widget.range(node.from));
          }
        });
    }
  }

  get decorations(): RangeSet<Decoration> {
    return Decoration.set(this.accountDecorations);
  }
}

const pluginSpec: PluginSpec<ComboWidgetView> = {
  decorations: (value: ComboWidgetView) => {
    return value.decorations;
  },
};

export interface ComboWidgetProps {
  match: (node: SyntaxNodeRef, update: ViewUpdate) => boolean;
  data: (props: ComboProps) => Array<{ label: string; value: string }>;
  read?: (data: string) => string;
  write?: (data: string) => string;
}

export function comboWidget(props: ComboWidgetProps) {
  return ViewPlugin.define(
    (view) => new ComboWidgetView(view, props),
    pluginSpec,
  );
}
