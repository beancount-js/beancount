import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beanCount } from "@beancount-js/codemirror-lang-beancount";
import { afterEach, describe, expect, test } from "vitest";
import { determineCurrencyColumn } from "./ruler";

describe("determineCurrencyColumn", () => {
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  test("uses posting currencies rather than long open directives", () => {
    const doc = `2026-07-17 open Assets:Investments:ISA:StocksAndShares GBP

2026-07-17 * "Coffee"
  Assets:Checking:Starling   -3.50 GBP
  Expenses:Food:Coffee        3.50 GBP
`;
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({ doc, extensions: [beanCount()] }),
    });

    expect(determineCurrencyColumn(view)).toBe(
      doc.split("\n")[3]!.indexOf("GBP"),
    );
  });
});
