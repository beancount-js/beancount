import { describe, test, expect } from "vitest";
import { parseDirectives } from "../parser/parser";
import { filterLedger } from "./filter";
import { formatDate } from "@beancount-js/parser";

describe("Filter", () => {
  const [directives, directiveErrors] = parseDirectives(`
        2014-12-26 balance Liabilities:US:CreditCard -3492.02 USD
        2014-02-03 open Assets:US:BofA:Checking
        2015-01-05 * "Investing 40% of cash in VBMPX" "Investment in Barclays Bitcoin" #barclays ^bitcoin
          held: true
          account: Barclays
          Assets:US:Vanguard:VBMPX          3.513 VBMPX {136.65 USD, 2015-01-05 }
          Assets:US:Vanguard:Cash         -480.05 USD
            stock: "Index Fund"
     `);
  expect(directiveErrors).toEqual([]);

  const testCases: Array<{
    description?: string;
    query: string | string[];
    expected: Array<string>;
  }> = [
    {
      description: "empty query",
      query: "",
      expected: [
        "open:2014-02-03",
        "balance:2014-12-26",
        "transaction:2015-01-05",
      ],
    },
    {
      query: "date: 2015-01-05",
      expected: ["transaction:2015-01-05"],
    },
    {
      query: "date < 2015-01-05",
      expected: ["open:2014-02-03", "balance:2014-12-26"],
    },
    {
      query: [
        "date: 2014-02-03 - 2014-12-25",
        "date: (2014-02-03 - 2014-12-25)",
      ],
      expected: ["open:2014-02-03"],
    },
    {
      query: ["amount < 480.05"],
      expected: ["transaction:2015-01-05"],
    },
    {
      query: ["amount > 480.05"],
      expected: ["balance:2014-12-26"],
    },
    {
      query: ["480.05", "-480.05"],
      expected: ["transaction:2015-01-05"],
    },
    {
      query: ["3.513", "-3.513", "136.65"],
      expected: ["transaction:2015-01-05"],
    },
    {
      query: ["VBMPX"],
      expected: ["transaction:2015-01-05"],
    },
    {
      query: ["USD", "/usd/i"],
      expected: ["balance:2014-12-26", "transaction:2015-01-05"],
    },
    {
      query: ["held: true", "attr.held: true", "meta.held: true"],
      expected: ["transaction:2015-01-05"],
    },
    {
      query: ["stock: 'Index Fund'", "stock: /index fund/i"],
      expected: ["transaction:2015-01-05"],
    },
  ];

  testCases.forEach((testCase) => {
    const queries = Array.isArray(testCase.query)
      ? testCase.query
      : [testCase.query];
    queries.forEach((query) => {
      test(`${testCase.description || ""} ${query}`.trim(), () => {
        const [[filtered], errors] = filterLedger(directives, query);
        expect(errors).toEqual([]);
        expect(
          filtered.map((it) => `${it.directiveType}:${formatDate(it.date)}`),
        ).toEqual(testCase.expected);
      });
    });
  });
});
