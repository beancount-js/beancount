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
import { mount, unmount } from "svelte";

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

  eq(other: unknown) {
    return (
      other instanceof ComboWidget &&
      this.state.nodeName === other.state.nodeName &&
      this.state.from === other.state.from &&
      this.state.to === other.state.to &&
      this.state.account === other.state.account
    );
  }

  private mounted = new WeakMap<HTMLElement, ReturnType<typeof mount>>();
  destroy(dom: HTMLElement) {
    const component = this.mounted.get(dom);
    if (component) void unmount(component);
    this.mounted.delete(dom);
  }
  toDOM(view: EditorView) {
    // Zero-width host so the icon does not contribute to CodeMirror line wrapping.
    const span = document.createElement("span");
    span.className = "cm-account-combo-host";
    span.dataset.nodeName = this.state.nodeName;
    const component = mount(ComboWidgetComponent, {
      target: span,
      context: this.state.props.context,
      props: {
        value: this.state.account,
        nodeName: this.state.nodeName,
        items: () => this.state.props.data(this.state),
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
    this.mounted.set(span, component);
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

class ComboWidgetView implements PluginValue {
  comboDecorations: Array<Range<Decoration>> = [];
  /**
   * Map decoration position → account span so the icon shows while the caret is
   * in the account.
   */
  ranges: Record<string, { from: number; to: number }> = {};

  constructor(
    readonly view: EditorView,
    readonly props: ComboWidgetProps,
  ) {}

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.ranges = {};
      this.comboDecorations = [];
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
              side: 1,
            });
            // Sit just after the account text as a small affordance.
            this.ranges[node.to.toString()] = {
              from: node.from,
              to: node.to,
            };
            this.comboDecorations.push(widget.range(node.to));
          }
        });
    }
  }

  get decorations(): RangeSet<Decoration> {
    const pos = this.view.state.selection.main.head;
    return Decoration.set(
      this.comboDecorations.filter((it) => {
        const span = this.ranges[it.from.toString()];
        return span ? pos >= span.from && pos <= span.to : false;
      }),
    );
  }
}

const pluginSpec: PluginSpec<ComboWidgetView> = {
  decorations: (value: ComboWidgetView) => {
    return value.decorations;
  },
};

export interface ComboWidgetProps {
  /** Preserve the owning editor's ledger and project authority in mounted widgets. */
  context?: Map<unknown, unknown>;
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
