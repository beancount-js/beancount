import { describe, expect, test } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beanCount } from "@beancount-js/codemirror-lang-beancount";
import { beancountFormat, formatLedger } from "./format";
import dedent from "dedent";

describe("beancountFormat", () => {
  const testCases: Array<{ inputs: Array<string>; expected: string }> = [
    {
      inputs: [
        `
            2017-09-08 * "China Garden" "Eating out with Joe"
             Liabilities:US:Chase:Slate -14.41 USD
             Expenses:Food:Restaurant 14.41 USD
            `,
        `
            2017-09-08 * "China Garden" "Eating out with Joe"
                 Liabilities:US:Chase:Slate                 -14.41 USD
                     Expenses:Food:Restaurant                      14.41   USD
            `,
      ],
      expected: `
            2017-09-08 * "China Garden" "Eating out with Joe"
              Liabilities:US:Chase:Slate  -14.41 USD
              Expenses:Food:Restaurant     14.41 USD
            `,
    },
  ];

  testCases.forEach((testCase, i) => {
    testCase.inputs.forEach((input, j) => {
      test(`${i}:${j} ${input}`, () => {
        expect(beancountFormat(input).trim()).toEqual(
          dedent(testCase.expected).trim(),
        );
      });
    });
  });

  test("aligns raw active-review postings", () => {
    const view = new EditorView({
      parent: document.body,
      state: EditorState.create({
        doc: `2026-07-17 * "Coffee"
  Assets:Checking:Starling -3.50 GBP
  Expenses:Food:Coffee 3.50 GBP
`,
        extensions: [beanCount()],
      }),
    });

    formatLedger(view);
    const currencyColumns = view.state.doc
      .toString()
      .split("\n")
      .filter((line) => line.includes(" GBP"))
      .map((line) => line.indexOf("GBP"));

    expect(new Set(currencyColumns)).toHaveLength(1);
    view.destroy();
  });
});
