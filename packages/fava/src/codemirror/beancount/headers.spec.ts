import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beanCount } from "@beancount-js/codemirror-lang-beancount";
import { afterEach, describe, expect, test } from "vitest";
import { decorateHeaders } from "./headers";

describe("decorateHeaders", () => {
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  test("hides ## markers when the cursor leaves the heading line", () => {
    const doc = `## Expenses

2020-01-01 open Assets:Cash

### Nested
`;
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        extensions: [beanCount(), decorateHeaders()],
      }),
    });

    const openPos = doc.indexOf("2020");
    view.dispatch({ selection: { anchor: openPos } });
    expect(view.contentDOM.textContent ?? "").not.toContain("## Expenses");
    expect(view.contentDOM.textContent ?? "").toContain("Expenses");
    expect(view.contentDOM.textContent ?? "").not.toContain("### Nested");
    expect(view.contentDOM.textContent ?? "").toContain("Nested");

    view.dispatch({ selection: { anchor: 0 } });
    expect(view.contentDOM.textContent ?? "").toContain("## Expenses");

    view.dispatch({ selection: { anchor: openPos } });
    expect(view.contentDOM.textContent ?? "").not.toContain("## Expenses");
    expect(view.contentDOM.textContent ?? "").toContain("Expenses");
  });
});
