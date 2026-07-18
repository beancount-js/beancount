import { foldEffect, foldable } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beanCount } from "@beancount-js/codemirror-lang-beancount";
import { afterEach, describe, expect, test } from "vitest";
import { metadataFolding } from "../beancount/foldMetadata";
import { foldGutter } from "./foldGutter";

describe("foldGutter", () => {
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  test("classifies metadata and updates its active state", () => {
    const doc = `2026-07-17 * "Coffee"
  import_id: "transaction-1"
  import_source: "monzo"
  Assets:Checking:Monzo  -3.50 GBP
  Expenses:Food
`;
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        extensions: [beanCount(), metadataFolding, foldGutter()],
      }),
    });

    expect(
      view.dom.querySelector(".fold-icon-metadata.fold-icon-expanded"),
    ).toBeTruthy();
    expect(
      view.dom.querySelector(".fold-icon-posting.fold-icon-expanded"),
    ).toBeTruthy();

    const line = view.state.doc.line(2);
    const range = foldable(view.state, line.from, line.to)!;
    view.dispatch({
      selection: { anchor: line.from },
      effects: foldEffect.of(range),
    });

    expect(
      view.dom.querySelector(
        ".fold-icon-metadata.fold-icon-collapsed.fold-icon-active",
      ),
    ).toBeTruthy();
  });
});
