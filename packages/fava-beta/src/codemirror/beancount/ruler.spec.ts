import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beanCount } from "@beancount-js/codemirror-lang-beancount";
import { afterEach, describe, expect, test, vi } from "vitest";
import { determineCurrencyColumn, rulerPlugin } from "./ruler";

function waitForMeasure() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

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

  test("only recalculates the ruler column after document changes", async () => {
    const column = vi.fn(() => 24);
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: '2026-07-17 * "Coffee"\n  Assets:Checking  -3.50 GBP',
        extensions: [rulerPlugin(column)],
      }),
    });

    await waitForMeasure();
    const initialCalls = column.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    view.dispatch({ selection: { anchor: 1 } });
    await waitForMeasure();
    expect(column).toHaveBeenCalledTimes(initialCalls);

    view.dispatch({ changes: { from: 0, insert: ";" } });
    await waitForMeasure();
    expect(column).toHaveBeenCalledTimes(initialCalls + 1);
  });
});
