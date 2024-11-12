import { describe, test } from "vitest";

import { beancountLanguage } from "../dist/index.js";
import { testTree } from "@lezer/generator/dist/test";

const parser = beancountLanguage.parser;
/**
 * @see https://beancount.github.io/docs/beancount_language_syntax.html
 */
const testCases: Record<string, Array<{ input: string; expected: string }>> = {
  Open: [
    {
      input: "2014-02-03 open Assets:US:BofA:Checking",
      expected: "Journal(Open(Date,OPEN,AccountName))",
    },
    {
      input: "2014-05-01 open Liabilities:CreditCard:CapitalOne USD",
      expected: "Journal(Open(Date,OPEN,AccountName,Currencies(Currency)))",
    },
    {
      input: "2014-05-01 open Liabilities:CreditCard:CapitalOne USD, GBP",
      expected:
        "Journal(Open(Date,OPEN,AccountName,Currencies(Currency,Currency)))",
    },
    ...["STRICT", "NONE", "AVERAGE", "FIFO", "LIFO", "HIFO"]
      .map((it) => {
        return [
          {
            input: `2014-05-01 open Liabilities:CreditCard:CapitalOne ${it}`,
            expected: "Journal(Open(Date,OPEN,AccountName,BookingMethod))",
          },
          {
            input: `2014-05-01 open Liabilities:CreditCard:CapitalOne USD ${it}`,
            expected:
              "Journal(Open(Date,OPEN,AccountName,Currencies(Currency),BookingMethod))",
          },
          {
            input: `2014-05-01 open Liabilities:CreditCard:CapitalOne USD, GBP ${it}`,
            expected:
              "Journal(Open(Date,OPEN,AccountName,Currencies(Currency,Currency),BookingMethod))",
          },
        ];
      })
      .flat(),
  ],
  Close: [
    {
      input: "2016-11-28 close Liabilities:CreditCard:CapitalOne",
      expected: "Journal(Close(Date,CLOSE,AccountName))",
    },
  ],
  Commodity: [
    {
      input: "1867-07-01 commodity CAD",
      expected: "Journal(Commodity(Date,COMMODITY,Currency))",
    },
    {
      input: `
        1867-07-01 commodity CAD
          name: "Canadian Dollar"
          asset-class: "cash"
      `.trim(),
      expected: `
        Journal(
          Commodity(
            Date,COMMODITY,Currency,
            Metadata(
              Attribute(MetaName,MetaValue(String)),
              Attribute(MetaName,MetaValue(String))
            )
          )
        )
      `,
    },
  ],
  Transactions: [
    {
      input: `
        2014-05-05 "Cafe Mogador"
          Liabilities:CreditCard:CapitalOne         -37.45 USD
          Expenses:Restaurant
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            ),
            Posting(AccountName)
          )
        )
      `,
    },
    {
      input: `
        2014-05-05 "Cafe Mogador" "Lamb tagine with wine"
          Liabilities:CreditCard:CapitalOne         -37.45 USD
          Expenses:Restaurant
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,String,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            ),
            Posting(AccountName)
          )
        )
      `,
    },
    ...["!", "#", "*", "txn", "P"].map((flag) => {
      return {
        input: `
          2014-05-05 ${flag} "Cafe Mogador" "Lamb tagine with wine"
            Liabilities:CreditCard:CapitalOne         -37.45 USD
            Expenses:Restaurant
        `.trim(),
        expected: `
          Journal(
            Transaction(
              Date,Flag,String,String,
              Posting(
                AccountName,Amount(NumberExpr(Number),Currency)
              ),
              Posting(AccountName)
            )
          )
        `,
      };
    }),
    ...["!", "#", "*", "P", "S"].map((flag) => {
      return {
        input: `
         2014-05-05 "Cafe Mogador" "Lamb tagine with wine"
           ${flag} Liabilities:CreditCard:CapitalOne         -37.45 USD
           ${flag} Expenses:Restaurant
       `.trim(),
        expected: `
         Journal(
           Transaction(
             Date,String,String,
             Posting(
               Flag,AccountName,Amount(NumberExpr(Number),Currency)
             ),
             Posting(Flag,AccountName)
           )
         )
       `,
      };
    }),
    {
      input: `
      2014-10-05 * "Costco" "Shopping for birthday"
        Liabilities:CreditCard:CapitalOne         -25.00          USD
        Assets:AccountsReceivable:John            ((60.00/3) + 5) USD
    `.trim(),
      expected: `
      Journal(
        Transaction(
          Date,Flag,String,String,
          Posting(
            AccountName,
            Amount(NumberExpr(Number),Currency)
          ),
          Posting(
            AccountName,
            Amount(
              NumberExpr(LPAREN,NumberExpr(NumberExpr(LPAREN,NumberExpr(NumberExpr(Number),SLASH,NumberExpr(Number)),RPAREN),
              PLUS,
              NumberExpr(Number)),RPAREN),
            Currency)
          )
        )
      )
    `,
    },
    {
      input: `
        2012-11-03 * "Transfer to account in Canada"
          Assets:MyBank:Checking            -400.00 USD @ 1.09 CAD
          Assets:FR:SocGen:Checking          436.01 CAD
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              PostingPrice(AT,Amount(NumberExpr(Number),Currency))
            ),
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            )
          )
        )
      `,
    },
    {
      input: `
        2012-11-03 * "Transfer to account in Canada"
          Assets:MyBank:Checking            -400.00 USD @@ 436.01 CAD
          Assets:FR:SocGen:Checking          436.01 CAD
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              TotalCost(ATAT,Amount(NumberExpr(Number),Currency))
            ),
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                10 IVV {183.07 USD}
          Assets:ETrade:Cash         -1830.70 USD
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,Amount(NumberExpr(Number),Currency),BraceR)
            ),
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                10 IVV { # 183.07 USD}
          Assets:ETrade:Cash         -1830.70 USD
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,CostPer(Amount(NumberExpr(Number),Currency)),BraceR)
            ),
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                10 IVV { 245 # 183.07 USD}
          Assets:ETrade:Cash         -1830.70 USD
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,CostTotal(NumberExpr(Number),Amount(NumberExpr(Number),Currency)),BraceR)
            ),
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                10 IVV {{ 183.07 USD }}
          Assets:ETrade:Cash         -1830.70 USD
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              CostTotalValue(BraceL,Cost(BraceL,Amount(NumberExpr(Number),Currency),BraceR),BraceR)
            ),
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-07-11 * "Sold shares of S&P 500"
          Assets:ETrade:IVV               -10 IVV {183.07 USD} @ 197.90 USD
          Assets:ETrade:Cash          1979.90 USD
          Income:ETrade:CapitalGains
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,Amount(NumberExpr(Number),Currency),BraceR),
              PostingPrice(AT,Amount(NumberExpr(Number),Currency))
            ),
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            ),
            Posting(AccountName)
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                20 IVV {}
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,BraceR)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                20 IVV {183.07 USD}
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,Amount(NumberExpr(Number),Currency),BraceR)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                20 IVV {2014-02-11}
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,Date,BraceR)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                20 IVV {"ref-001"}
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,String,BraceR)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                20 IVV {183.07 USD, 2014-02-11}
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,Amount(NumberExpr(Number),Currency),Date,BraceR)
            )
          )
        )
      `,
    },
    {
      input: `
        2014-02-11 * "Bought shares of S&P 500"
          Assets:ETrade:IVV                20 IVV {183.07 USD, 2014-02-11, "ref-001"}
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency),
              Cost(BraceL,Amount(NumberExpr(Number),Currency),Date,String,BraceR)
            )
          )
        )
      `,
    },
  ],
  "Tags/Links": [
    {
      input: "pushtag #berlin-trip-2014",
      expected: "Journal(PushTag(PUSHTAG,Tag))",
    },
    {
      input: "poptag #berlin-trip-2014",
      expected: "Journal(PopTag(POPTAG,Tag))",
    },
    {
      input: `
      2014-04-23 * "Flight to Berlin" #berlin-trip-2014 ^link #germany
        Expenses:Flights              -1230.27 USD
        Liabilities:CreditCard
      `.trim(),
      expected: `
        Journal(
          Transaction(
            Date,Flag,String,
            Tag,Link,Tag,
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency)
            ),
            Posting(AccountName)
          )
        )
      `,
    },
  ],
  Balance: [
    {
      input: "2014-12-26 balance Liabilities:US:CreditCard   -3492.02 USD",
      expected:
        "Journal(Balance(Date,BALANCE,AccountName,NumberExpr(Number),Currency))",
    },
    {
      input:
        "2013-09-20 balance Assets:Investing:Funds     319.020 ~ 0.002 RGAGX",
      expected:
        "Journal(Balance(Date,BALANCE,AccountName,NumberExpr(Number),Tolerance(TILDE,NumberExpr(Number)),Currency))",
    },
  ],
  Pad: [
    {
      input: "2014-06-01 pad Assets:BofA:Checking Equity:Opening-Balances",
      expected: "Journal(Pad(Date,PAD,AccountName,AccountName))",
    },
  ],
  Notes: [
    {
      input: `2013-11-03 note Liabilities:CreditCard "Called about fraudulent card."`,
      expected: "Journal(Note(Date,NOTE,AccountName,String))",
    },
  ],
  Document: [
    {
      input: `2013-11-03 document Liabilities:CreditCard "/home/joe/stmts/apr-2014.pdf"`,
      expected: "Journal(Document(Date,DOCUMENT,AccountName,String))",
    },
  ],
  Prices: [
    {
      input: `2014-07-09 price USD  1.08 CAD`,
      expected:
        "Journal(Price(Date,PRICE,Currency,Amount(NumberExpr(Number),Currency)))",
    },
  ],
  Custom: [
    ...["TRUE", "true", "false", "FALSE"].map((v) => {
      return {
        input: `2014-07-09 custom "budget" "String" ${v} 45.30 USD 2021-12-05`,
        expected: `
          Journal(
            Custom(
              Date,CUSTOM,String,
              MetaValue(String),
              MetaValue(Bool),
              MetaValue(NumberExpr(Number)),
              MetaValue(Currency),
              MetaValue(Date)
            )
          )
        `,
      };
    }),
  ],
  Events: [
    {
      input: `2014-07-09 event "location" "Paris, France"`,
      expected: "Journal(Event(Date,EVENT,String,String))",
    },
  ],
  Query: [
    {
      input: `
      2014-07-09 query "france-balances" "
        SELECT account, sum(position) WHERE 'trip-france-2014' in tags"
      `.trim(),
      expected: "Journal(Query(Date,QUERY,String,String))",
    },
    {
      input: `
      2014-07-09 query "france-balances" \`\`\`
        SELECT account, sum(position) WHERE 'trip-france-2014' in tags"
      \`\`\`
      `.trim(),
      expected: "Journal(Query(Date,QUERY,String,CodeBlock))",
    },
  ],
  Options: [
    {
      input: `option "title" "Ed’s Personal Ledger"`,
      expected: "Journal(Option(OPTION,String,String))",
    },
  ],
  Plugins: [
    {
      input: `plugin "beancount.plugins.module_name" "config"`,
      expected: "Journal(Plugin(PLUGIN,String,String))",
    },
  ],
  Include: [
    {
      input: `include "path/to/include/file.beancount"`,
      expected: "Journal(Include(INCLUDE,String))",
    },
  ],
  Comments: [
    {
      input: `
        ; comment line 1
        ; comment line 2
        2014-02-03 open Assets:US:BofA:Checking ; inline comment
      `.trim(),
      expected:
        "Journal(Comment,DocumentMarkup,Comment,Open(Date,OPEN,AccountName,Comment))",
    },
    {
      input: `
        ; initial comment
        2014-05-05 "Cafe Mogador" "Lamb tagine with wine" ; Tx comment
          ; Posting comment
          Liabilities:CreditCard:CapitalOne         -37.45 USD ; inline posting comment
          ; Posting comment 2
          Expenses:Restaurant ; inline posting comment
      `.trim(),
      expected: `
        Journal(
          Comment,DocumentMarkup,
          Transaction(
            Date,String,String,Comment,Comment
            Posting(
              AccountName,Amount(NumberExpr(Number),Currency), Comment, Comment
            ),
            Posting(AccountName,Comment)
          )
        )
      `,
    },
  ],
};

for (const [key, cases] of Object.entries(testCases)) {
  describe(key, () => {
    cases.forEach((testCase) =>
      test(testCase.input, () =>
        testTree(parser.parse(testCase.input), testCase.expected),
      ),
    );
  });
}
