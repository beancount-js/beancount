import { describe, test, expect } from "vitest";
import { parseDocument } from "./document";
import dedent from "dedent";

const testCases: Record<string, Array<{ input: string; expected?: string }>> = {
  Open: [
    {
      input: `
        2014-02-03 open Assets:US:BofA:Checking
      `,
    },
    {
      input: "2014-05-01 open Liabilities:CreditCard:CapitalOne USD",
    },
    {
      input: "2014-05-01 open Liabilities:CreditCard:CapitalOne USD,GBP",
    },
    ...["STRICT", "NONE", "AVERAGE", "FIFO", "LIFO", "HIFO"]
      .map((it) => {
        return [
          {
            input: `2014-05-01 open Liabilities:CreditCard:CapitalOne ${it}`,
          },
          {
            input: `2014-05-01 open Liabilities:CreditCard:CapitalOne USD ${it}`,
          },
          {
            input: `2014-05-01 open Liabilities:CreditCard:CapitalOne USD,GBP ${it}`,
          },
        ];
      })
      .flat(),
  ],
  Close: [
    {
      input: "2016-11-28 close Liabilities:CreditCard:CapitalOne",
    },
  ],
  Commodity: [
    {
      input: "1867-07-01 commodity CAD",
    },
    {
      input: `
        1867-07-01 commodity CAD
          name: "Canadian Dollar"
          asset-class: "cash"
      `,
    },
  ],
  "Tags/Links": [
    {
      input: "pushtag #berlin-trip-2014",
    },
    {
      input: `
      pushtag #berlin-trip-2014

      poptag #berlin-trip-2014
      `,
    },
    {
      input: `
      2014-04-23 * "Flight to Berlin" #berlin-trip-2014 ^link #germany
        Expenses:Flights -1230.27 USD
        Liabilities:CreditCard
      `,
    },
  ],
  Balance: [
    {
      input: "2014-12-26 balance Liabilities:US:CreditCard -3492.02 USD",
    },
    {
      input: "2013-09-20 balance Assets:Investing:Funds 319.020 ~ 0.002 RGAGX",
    },
  ],
  Pad: [
    {
      input: "2014-06-01 pad Assets:BofA:Checking Equity:Opening-Balances",
    },
  ],
  Notes: [
    {
      input: `2013-11-03 note Liabilities:CreditCard "Called about fraudulent card."`,
    },
  ],
  Document: [
    {
      input: `2013-11-03 document Liabilities:CreditCard "/home/joe/stmts/apr-2014.pdf"`,
    },
  ],
  Prices: [
    {
      input: `2014-07-09 price USD 1.08 CAD`,
    },
  ],
  Custom: [
    ...["TRUE", "true", "false", "FALSE"].map((v) => {
      return {
        input: `2014-07-09 custom "budget" "String" ${v} 45.30 USD 2021-12-05`,
        expected: `2014-07-09 custom "budget" "String" ${v.toUpperCase()} 45.30 USD 2021-12-05`,
      };
    }),
  ],
  Events: [
    {
      input: `2014-07-09 event "location" "Paris, France"`,
    },
  ],
  Query: [
    {
      input: `
      2014-07-09 query "france-balances" "
        SELECT account, sum(position) WHERE 'trip-france-2014' in tags"
      `,
    },
    {
      input: `
      2014-07-09 query "france-balances" \`\`\`
        SELECT account, sum(position) WHERE 'trip-france-2014' in tags"
      \`\`\``,
    },
  ],
  Options: [
    {
      input: `option "title" "Ed's Personal Ledger"`,
    },
  ],
  Plugins: [
    {
      input: `plugin "beancount.plugins.module_name" "config"`,
    },
  ],
  Include: [
    {
      input: `include "path/to/include/file.beancount"`,
    },
  ],
  Comments: [
    {
      input: `
        ; comment line 1
        ; comment line 2
        2014-02-03 open Assets:US:BofA:Checking ; inline comment
      `,
    },
    {
      input: `
        ; initial comment
        2014-05-05 "Cafe Mogador" "Lamb tagine with wine" ; Tx comment
          string: "string"
          number: 24.5
        ; Posting comment
          Liabilities:CreditCard:CapitalOne -37.45 USD ; inline posting comment
            currency: GBP
        ; Posting comment 2
          Expenses:Restaurant ; inline posting comment
            amount: 25 GBP
            account: Assets:Income
      `,
    },
  ],
};

for (const [key, cases] of Object.entries(testCases)) {
  describe(key, () => {
    cases.forEach((testCase) => {
      const input = dedent(testCase.input).trim();
      test(input, () => {
        const doc = parseDocument(input);
        expect(doc.errors).toEqual([]);
        expect(doc.toString()).toBe(testCase.expected ?? input);
      });
    });
  });
}
