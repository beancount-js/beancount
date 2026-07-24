import { EditorState } from "@codemirror/state";
import { codeFolding, foldedRanges } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { beanCount } from "@beancount-js/codemirror-lang-beancount";
import { afterEach, describe, expect, test } from "vitest";
import {
  areAllHeadersCollapsed,
  collapseHeaders,
  collapseHeadersExceptLast,
  expandHeaders,
  foldHeaders,
  headerFoldRanges,
} from "./foldHeaders";

function foldedRangeList(state: EditorState) {
  const ranges: Array<{ from: number; to: number }> = [];
  foldedRanges(state).between(0, state.doc.length, (from, to) => {
    ranges.push({ from, to });
  });
  return ranges;
}

describe("foldHeaders", () => {
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  test("collapses older date groups while leaving the latest group open", () => {
    const doc = `## 2026-01

2026-01-08 * "First"
  Assets:Checking  -1 GBP
  Expenses:Food

## 2026-02

2026-02-12 * "Latest"
  Assets:Checking  -2 GBP
  Expenses:Food
`;
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        extensions: [beanCount(), foldHeaders(), codeFolding()],
      }),
    });

    const ranges = headerFoldRanges(view.state);
    expect(ranges).toHaveLength(2);

    collapseHeadersExceptLast(view);
    expect(foldedRangeList(view.state)).toEqual([ranges[0]]);
    expect(areAllHeadersCollapsed(view.state)).toBe(false);

    collapseHeaders(view);
    expect(foldedRangeList(view.state)).toEqual(ranges);
    expect(areAllHeadersCollapsed(view.state)).toBe(true);

    expandHeaders(view);
    expect(foldedRangeList(view.state)).toEqual([]);
  });
});
