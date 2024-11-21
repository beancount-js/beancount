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
import DatePickerWidgetComponent from "./datePickerWidget.svelte";
import {
  getLocalTimeZone,
  parseDate,
  type DateValue,
} from "@internationalized/date";
import { formatDate } from "@beancount-js/parser";


export interface DatePickerProps {
  from: number;
  to: number;
  date: string;
}

class DatePickerWidget extends WidgetType {
  constructor(readonly state: DatePickerProps) {
    super();
  }

  eq(other: any) {
    return (
      this.state.date === other.state.date &&
      this.state.from === other.state.from
    );
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    const component = new DatePickerWidgetComponent({
      target: span,
      props: {
        value: parseDate(this.state.date),
        onValueChange: (value: DateValue | undefined) => {
          if (!value) {
            return;
          }
          const date = formatDate(value.toDate(getLocalTimeZone()));
          view.dispatch({
            changes: [
              {
                from: this.state.from,
                to: this.state.to,
                insert: date,
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

export interface DateProps {
  node: string;
}

class DatePickerWidgetView implements PluginValue {
  dateDecorations: Array<Range<Decoration>> = [];
  ranges: Record<string, number> = {};

  constructor(
    readonly view: EditorView,
    readonly props: DateProps,
  ) {}

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.ranges = {};
      this.dateDecorations = [];
      syntaxTree(update.state)
        .cursor()
        .iterate((node) => {
          if (node.name === this.props.node) {
            const date = update.state.sliceDoc(node.from, node.to);
            const widget = Decoration.widget({
              widget: new DatePickerWidget({
                from: node.from,
                to: node.to,
                date,
              }),
            });
            this.ranges[node.from.toString()] = node.to;
            this.dateDecorations.push(widget.range(node.from));
          }
        });
    }
  }

  get decorations(): RangeSet<Decoration> {
    const pos = this.view.state.selection.main.head;
    return Decoration.set(
      this.dateDecorations.filter((it) => {
        const to = this.ranges[it.from.toString()];
        return pos >= it.from && pos <= to;
      }),
    );
  }
}

const pluginSpec: PluginSpec<DatePickerWidgetView> = {
  decorations: (value: DatePickerWidgetView) => {
    return value.decorations;
  },
};

export function datePicker(props: DateProps = { node: "Date" }) {
  return ViewPlugin.define(
    (view) => new DatePickerWidgetView(view, props),
    pluginSpec,
  );
}