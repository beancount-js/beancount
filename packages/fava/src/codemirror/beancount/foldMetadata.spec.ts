import { EditorState } from "@codemirror/state";
import { codeFolding, foldable, foldedRanges } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { beanCount } from "@beancount-js/codemirror-lang-beancount";
import { afterEach, describe, expect, test } from "vitest";
import {
  foldMetadata,
  metadataFoldEffects,
  metadataFolding,
} from "./foldMetadata";

function foldedRangeList(state: EditorState) {
  const ranges: Array<{ from: number; to: number }> = [];
  foldedRanges(state).between(0, state.doc.length, (from, to) => {
    ranges.push({ from, to });
  });
  return ranges;
}

describe("foldMetadata", () => {
  let view: EditorView | undefined;

  afterEach(() => {
    view?.destroy();
    view = undefined;
  });

  test("folds transaction and posting metadata from the first property colon", () => {
    const doc = `2026-07-17 * "Coffee"
  import_id: "transaction-1"
  import_source: "monzo"
  import_status: "review"
  Assets:Checking:Monzo  -3.50 GBP
    import_id: "posting-1"
    import_source: "monzo"
  Expenses:Food
`;
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        extensions: [beanCount(), metadataFolding, codeFolding()],
      }),
    });

    const expected = [2, 6].map((lineNumber) => {
      const line = view!.state.doc.line(lineNumber);
      return foldable(view!.state, line.from, line.to)!;
    });

    expect(expected[0]).toEqual({
      from: doc.indexOf(":", view.state.doc.line(2).from) + 1,
      to: view.state.doc.line(4).to,
    });
    expect(expected[1]).toEqual({
      from: doc.indexOf(":", view.state.doc.line(6).from) + 1,
      to: view.state.doc.line(7).to,
    });
    expect(
      expected.map((range) =>
        view!.state.doc.sliceString(range.to, range.to + 1),
      ),
    ).toEqual(["\n", "\n"]);

    expect(
      metadataFoldEffects(view.state).map((effect) => effect.value),
    ).toEqual(expected);

    foldMetadata(view);
    expect(foldedRangeList(view.state)).toEqual(expected);
  });

  test("leaves a single metadata attribute unfolded", () => {
    const doc = `2026-07-17 * "Coffee"
  import_id: "transaction-1"
`;
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        extensions: [beanCount(), metadataFolding, codeFolding()],
      }),
    });

    foldMetadata(view);
    expect(foldedRangeList(view.state)).toEqual([]);
  });

  test("keeps the final metadata value intact when the document has no newline", () => {
    const doc = `2026-07-17 * "Coffee"
  import_id: "transaction-1"
  import_source: "monzo"`;
    view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc,
        extensions: [beanCount(), metadataFolding, codeFolding()],
      }),
    });

    const line = view.state.doc.line(2);
    expect(foldable(view.state, line.from, line.to)).toEqual({
      from: doc.indexOf(":", line.from) + 1,
      to: doc.length,
    });
  });
});
