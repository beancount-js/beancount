import { describe, expect, test } from "vitest";
import { beancountFormat } from "./format";
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
});
