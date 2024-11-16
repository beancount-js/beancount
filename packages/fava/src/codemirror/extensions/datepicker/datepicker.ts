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

  eq(other: unknown) {
    return other instanceof DatePickerWidget && (
      this.state.date === other.state.date &&
      this.state.from === other.state.from
    );
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    new DatePickerWidgetComponent({
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

class DatePickerWidgetView implements PluginValue {
  accountDecorations: Array<Range<Decoration>> = [];

  constructor(readonly view: EditorView) {}

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.accountDecorations = [];
      syntaxTree(update.state)
        .cursor()
        .iterate((node) => {
          if (node.name === "Date") {
            const date = update.state.sliceDoc(node.from, node.to);
            const widget = Decoration.widget({
              widget: new DatePickerWidget({
                from: node.from,
                to: node.to,
                date,
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

const pluginSpec: PluginSpec<DatePickerWidgetView> = {
  decorations: (value: DatePickerWidgetView) => {
    return value.decorations;
  },
};

export function datePicker() {
  return ViewPlugin.fromClass(DatePickerWidgetView, pluginSpec);
}
