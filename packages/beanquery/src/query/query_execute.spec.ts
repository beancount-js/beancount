import { Compiler } from "./compiler";
import { describe, test, expect } from "vitest";
import { Account, createDatabase } from "../sources/beancount";
import { DateTime, Duration } from "luxon";
import {
  Amount,
  DirectiveBase,
  Inventory,
  loadString,
  Position,
  sorted,
} from "@beancount-js/beancount";
import { Decimal } from "@beancount-js/parser";
import { AttributeColumn, EvalQuery } from "./nodes";
import { DType, INTEGER, isNull } from "./types";
import { Table } from "./models";
import { Context } from "./Context";

type TestCase = {
  source: string;
  input: string | string[];
  columns?: Array<{ name: string; type: DType }>;
  data?: unknown[][] | unknown | ((input: TestCase) => void);
};

function normalizeColumns(
  columns: Array<{ name: symbol | string; type: DType }>,
) {
  return columns.map((it) => {
    if (typeof it.name === "string") {
      return { name: it.name, type: it.type };
    }
    return { name: it.name.description, type: it.type };
  });
}

const FUNDAMENTALS = `
  2022-04-05 commodity TEST
    rate: 42
  2022-04-05 open Assets:Tests
  2022-04-05 * "Test"
    Assets:Tests  1.000 TEST
      int: 1
      decimal: 1.2
      bool: TRUE
      str: "str"
      str3: "3"
      str4: "4.0"
      date: 2022-04-05
      null: NULL
`;

const COMMON_INPUT = `
    2010-01-01 open Assets:Bank:Checking
    2010-01-01 open Assets:ForeignBank:Checking
    2010-01-01 open Assets:Bank:Savings
    2010-01-01 open Expenses:Restaurant

    2010-01-01 * "Dinner with Cero"
      Assets:Bank:Checking       100.00 USD
      Expenses:Restaurant       -100.00 USD

    2011-01-01 * "Dinner with Uno"
      Assets:Bank:Checking       101.00 USD
      Expenses:Restaurant       -101.00 USD

    2012-02-02 * "Dinner with Dos"
      Assets:Bank:Checking       102.00 USD
      Expenses:Restaurant       -102.00 USD

    2013-03-03 * "Dinner with Tres"
      Assets:Bank:Checking       103.00 USD
      Expenses:Restaurant       -103.00 USD

    2013-10-10 * "International Transfer"
      Assets:Bank:Checking         -50.00 USD
      Assets:ForeignBank:Checking  -60.00 CAD @ 1.20 USD

    2014-04-04 * "Dinner with Quatro"
      Assets:Bank:Checking       104.00 USD
      Expenses:Restaurant       -104.00 USD
`;

const NON_AGGREGATE_QUERY = `
  2010-01-01 open Assets:Bank:Checking
  2010-01-01 open Expenses:Restaurant

  2010-02-23 * "Bla"
    Assets:Bank:Checking       100.00 USD
    Expenses:Restaurant       -100.00 USD
`;

const ARRAY_OPS = `
1970-01-01 open Assets:Cash
2000-01-01 open Expenses:One
2000-01-02 open Expenses:Two
2000-01-03 open Expenses:Three

2025-01-01 * "One"
  Expenses:One                            100.00 USD
  Assets:Cash

2025-01-02 * "Two"
  Expenses:Two                             10.00 USD
  Assets:Cash

2025-01-03 * "Three"
  Expenses:Three                           50.00 USD
  Assets:Cash

2025-01-03 * "Three"
  Expenses:Three                            1.00 USD
  Assets:Cash
`;

const PIVOT_OPS = `
  2012-01-01 open Assets:Cash
  2012-01-01 open Expenses:Aaa
  2012-01-01 open Expenses:Bbb

  2012-01-01 * "Test"
    Expenses:Bbb  1.00 USD
    Assets:Cash

  2012-01-01 * "Test"
    Expenses:Aaa  2.00 USD
    Assets:Cash

  2012-02-02 * "Test"
    Expenses:Aaa  3.00 USD
    Assets:Cash

  2013-01-01 * "Test"
    Expenses:Aaa  4.00 USD
    Assets:Cash

  2014-02-02 * "Test"
    Expenses:Bbb  5.00 USD
    Assets:Cash

  2014-03-03 * "Test"
    Expenses:Aaa  6.00 USD
    Assets:Cash

  2013-01-01 * "Test"
    Expenses:Bbb  7.00 USD
    Assets:Cash

  2015-04-04 * "Test"
    Expenses:Aaa  8.00 USD
    Assets:Cash
`;

const testCases: Record<string, Array<TestCase>> = {
  Intervals: [
    {
      source: FUNDAMENTALS,
      input: `SELECT date_trunc('month', '2025-02-16 07:09:19-04'::timestamp) + INTERVAL '1 month - 1 day';`,
      data: DateTime.fromISO("2025-02-28T00:00:00.000+00:00"),
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT date_trunc_end('month', '2025-02-16 07:09:19-04'::timestamp)`,
      data: DateTime.fromISO("2025-02-28T23:59:59.999+00:00"),
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT '2018-09-02 07:09:19-04'::timestamptz AT TIME ZONE 'America/Chicago';`,
      data: DateTime.fromSQL("2018-09-02 07:09:19-04", {
        zone: "America/Chicago",
      }),
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT '1 day'::interval`,
      data: Duration.fromDurationLike({ day: 1 }),
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT interval '1 day'`,
      data: Duration.fromDurationLike({ day: 1 }),
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT interval '2 weeks 1 day' * 5`,
      data: Duration.fromDurationLike({ weeks: 10, day: 5 }),
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT interval '2 day 00:00:10' + 1`,
      data: Duration.fromDurationLike({
        day: 3,
        hours: 1,
        minutes: 1,
        seconds: 11,
      }),
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT INTERVAL '1 week' + INTERVAL '3 days'`,
      data: Duration.fromDurationLike({ week: 1, day: 3 }),
    },
  ],
  Case: [
    {
      source: FUNDAMENTALS,
      input: `
        SELECT 
          CASE
            WHEN now().year > 2024 THEN 'After 2024'
            ELSE 'Before 2024' 
          END dates
      `,
      columns: [{ name: "dates", type: String }],
      data: "After 2024",
    },
  ],
  "WildCard Columns": [
    {
      source: FUNDAMENTALS,
      input: `SELECT account, date.*`,
      columns: [
        { name: "account", type: Account },
        { name: "year", type: Number },
        { name: "month", type: Number },
        { name: "day", type: Number },
      ],
      data: [["Assets:Tests", 2022, 4, 5]],
    },
  ],
  "String Format": [
    {
      source: FUNDAMENTALS,
      input: `SELECT format('Hello %s', 'World')`,
      data: "Hello World",
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT format('Testing %s, %s, %s, %%', 'one', 'two', 'three');`,
      data: "Testing one, two, three, %",
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT format('|%10s|', 'foo')`,
      data: "|       foo|",
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT format('|%-10s|', 'foo')`,
      data: "|foo       |",
    },
    {
      source: FUNDAMENTALS,
      input: `SELECT format('|%*s|', 10, 'foo')`,
      data: "|       foo|",
    },
    {
      source: FUNDAMENTALS,
      input: [
        `SELECT format('|%-*s|', 10, 'foo')`,
        `SELECT format('|%-*s|', -10, 'foo')`,
        `SELECT format('|%*s|', -10, 'foo')`,
      ],
      data: "|foo       |",
    },
  ],
  "Type Casting: boolean": [
    {
      source: FUNDAMENTALS,
      input: ["SELECT bool(NULL)", "SELECT bool(meta('missing'))"],
      data: null,
    },
    {
      source: FUNDAMENTALS,
      input: [
        "SELECT bool(TRUE)",
        "SELECT bool(1)",
        "SELECT bool(1.1)",
        "SELECT bool('foo')",
        "SELECT bool(2022-04-05)",
        "SELECT bool(meta('int'))",
        "SELECT bool(meta('decimal'))",
        "SELECT bool(meta('bool'))",
        "SELECT bool(meta('str'))",
        "SELECT bool(meta('date'))",
        "SELECT bool(meta('null'))",
      ],
      data: true,
    },
  ],
  "Type Casting: integers": [
    {
      source: FUNDAMENTALS,
      input: [
        "SELECT int('foo')",
        "SELECT int(NULL)",
        "SELECT int(2022-04-05)",
        "SELECT int(meta('str'))",
        "SELECT int(meta('date'))",
        "SELECT int(meta('null'))",
        "SELECT int(meta('missing'))",
      ],
      data: null,
    },
    {
      source: FUNDAMENTALS,
      input: [
        "SELECT int(TRUE)",
        "SELECT int(1)",
        "SELECT int(1.2)",
        "SELECT int(meta('int'))",
        "SELECT int(meta('decimal'))",
        "SELECT int(meta('bool'))",
      ],
      data: 1,
    },
  ],
  "Type Operators: addition": [
    {
      source: FUNDAMENTALS,
      input: "SELECT 1 + 1",
      data: 2,
    },
    {
      source: FUNDAMENTALS,
      input: "SELECT 1.0 + 1",
      data: 2,
    },
    {
      source: FUNDAMENTALS,
      input: "SELECT 1.0 + 2.0",
      data: 3,
    },
    {
      source: FUNDAMENTALS,
      input: ["SELECT 2022-04-01 + 1", "SELECT 1 + 2022-04-01 "],
      data: DateTime.fromObject({ year: 2022, month: 4, day: 2 }),
    },
    {
      source: FUNDAMENTALS,
      input: "SELECT 'ab' + 'c'",
      data: "abc",
    },
  ],
  "Non Aggregate Query": [
    {
      source: NON_AGGREGATE_QUERY,
      input: "SELECT date",
      columns: [{ name: "date", type: DateTime }],
      data: [
        [
          DateTime.fromObject(
            { year: 2010, month: 2, day: 23 },
            { zone: "utc" },
          ),
        ],
        [
          DateTime.fromObject(
            { year: 2010, month: 2, day: 23 },
            { zone: "utc" },
          ),
        ],
      ],
    },
    {
      source: NON_AGGREGATE_QUERY,
      input: "SELECT date, flag, payee, narration;",
      columns: [
        { name: "date", type: DateTime },
        { name: "flag", type: String },
        { name: "payee", type: String },
        { name: "narration", type: String },
      ],
      data: [
        [
          DateTime.fromObject(
            { year: 2010, month: 2, day: 23 },
            { zone: "utc" },
          ),
          "*",
          "",
          "Bla",
        ],
        [
          DateTime.fromObject(
            { year: 2010, month: 2, day: 23 },
            { zone: "utc" },
          ),
          "*",
          "",
          "Bla",
        ],
      ],
    },
    {
      source: NON_AGGREGATE_QUERY,
      input: [
        "SELECT account, length(account) ORDER BY 2;",
        "SELECT account, length(account) ORDER BY length(account);",
      ],
      columns: [
        { name: "account", type: Account },
        { name: "length(account)", type: Number },
      ],
      data: [
        ["Expenses:Restaurant", 19],
        ["Assets:Bank:Checking", 20],
      ],
    },
    {
      source: NON_AGGREGATE_QUERY,
      input: "SELECT account ORDER BY length(account);",
      columns: [{ name: "account", type: Account }],
      data: [["Expenses:Restaurant"], ["Assets:Bank:Checking"]],
    },
    {
      source: NON_AGGREGATE_QUERY,
      input: [
        "SELECT account ORDER BY cost_date",
        "SELECT account ORDER BY posting_flag",
      ],
      columns: [{ name: "account", type: Account }],
      data: [["Assets:Bank:Checking"], ["Expenses:Restaurant"]],
    },
  ],
  "Aggregated Query": [
    {
      source: NON_AGGREGATE_QUERY,
      input: "SELECT first(account), last(account)",
      columns: [
        { name: "first(account)", type: Account },
        { name: "last(account)", type: Account },
      ],
      data: [["Assets:Bank:Checking", "Expenses:Restaurant"]],
    },
    {
      source: NON_AGGREGATE_QUERY,
      input: `
        SELECT account, length(account) as len
        GROUP BY account, len;
      `,
      columns: [
        { name: "account", type: Account },
        { name: "len", type: Number },
      ],
      data: [
        ["Assets:Bank:Checking", 20],
        ["Expenses:Restaurant", 19],
      ],
    },
    {
      source: `
        2010-02-21 * "First"
          Assets:Bank:Checking       -1.00 USD
          Expenses:Restaurant         1.00 USD

        2010-02-23 * "Second"
          Liabilities:Credit-Card    -2.00 USD
          Expenses:Restaurant         2.00 USD
      `,
      input: `
        SELECT account, length(account) as len
        GROUP BY account, len;
      `,
      columns: [
        { name: "account", type: Account },
        { name: "len", type: Number },
      ],
      data: [
        ["Assets:Bank:Checking", 20],
        ["Expenses:Restaurant", 19],
        ["Liabilities:Credit-Card", 23],
      ],
    },
    // GROUP-BY: 'account' is visible.
    {
      source: NON_AGGREGATE_QUERY,
      input: `
        SELECT account, sum(position) as amount
        GROUP BY account;
      `,
      columns: [
        { name: "account", type: Account },
        { name: "amount", type: Inventory },
      ],
      data: [
        [
          "Assets:Bank:Checking",
          new Inventory([new Position(new Amount("100.00", "USD"))]),
        ],
        [
          "Expenses:Restaurant",
          new Inventory([new Position(new Amount("-100.00", "USD"))]),
        ],
      ],
    },
    // GROUP-BY: 'account' is invisible.
    {
      source: NON_AGGREGATE_QUERY,
      input: `
        SELECT count(position)
        GROUP BY account;
      `,
      columns: [{ name: "count(position)", type: Number }],
      data: [[1], [1]],
    },
    // GROUP-BY: 'account' is visible.
    // ORDER-BY: 'account' is a non-aggregate and visible.
    {
      source: NON_AGGREGATE_QUERY,
      input: `
          SELECT account, sum(position) as amount
          GROUP BY account
          ORDER BY account;
      `,
      columns: [
        { name: "account", type: Account },
        { name: "amount", type: Inventory },
      ],
      data: [
        [
          "Assets:Bank:Checking",
          new Inventory([new Position(new Amount("100.00", "USD"))]),
        ],
        [
          "Expenses:Restaurant",
          new Inventory([new Position(new Amount("-100.00", "USD"))]),
        ],
      ],
    },
    {
      source: NON_AGGREGATE_QUERY,
      input: `
          SELECT account, sum(position) FILTER (WHERE account.type = 'Assets') as amount
          GROUP BY account
          ORDER BY account;
      `,
      columns: [
        { name: "account", type: Account },
        { name: "amount", type: Inventory },
      ],
      data: [
        [
          "Assets:Bank:Checking",
          new Inventory([new Position(new Amount("100.00", "USD"))]),
        ],
        ["Expenses:Restaurant", new Inventory()],
      ],
    },
    // GROUP-BY: 'account' and 'length(account)' are visible.
    // ORDER-BY: 'length(account)' is a non-aggregate and invisible.
    {
      source: NON_AGGREGATE_QUERY,
      input: `
          SELECT account, sum(position) as amount
          GROUP BY account, length(account)
          ORDER BY length(account);
      `,
      columns: [
        { name: "account", type: Account },
        { name: "amount", type: Inventory },
      ],
      data: [
        [
          "Expenses:Restaurant",
          new Inventory([new Position(new Amount("-100.00", "USD"))]),
        ],
        [
          "Assets:Bank:Checking",
          new Inventory([new Position(new Amount("100.00", "USD"))]),
        ],
      ],
    },
    // GROUP-BY: 'account' is visible.
    // ORDER-BY: 'sum(account)' is an aggregate and visible.
    {
      source: `
        2010-02-21 * "First"
            Assets:Bank:Checking       -1.00 USD
            Expenses:Restaurant         1.00 USD

        2010-02-23 * "Second"
          Liabilities:Credit-Card    -2.00 USD
          Expenses:Restaurant         2.00 USD
      `,
      input: `
          SELECT account, count(account) as num, sum(number) as sum
          GROUP BY account
          ORDER BY sum(number);
      `,
      columns: [
        { name: "account", type: Account },
        { name: "num", type: Number },
        { name: "sum", type: Decimal },
      ],
      data: [
        ["Liabilities:Credit-Card", 1, new Decimal("-2.00")],
        ["Assets:Bank:Checking", 1, new Decimal("-1.00")],
        ["Expenses:Restaurant", 2, new Decimal("3.00")],
      ],
    },
    // GROUP-BY: 'account' is visible.
    // ORDER-BY: 'sum(number)' is an aggregate and invisible.
    {
      source: `
        2010-02-21 * "First"
            Assets:Bank:Checking       -1.00 USD
            Expenses:Restaurant         1.00 USD

        2010-02-23 * "Second"
          Liabilities:Credit-Card    -2.00 USD
          Expenses:Restaurant         2.00 USD
      `,
      input: `
          SELECT account, count(account) as num
          GROUP BY account
          ORDER BY sum(number);
      `,
      columns: [
        { name: "account", type: Account },
        { name: "num", type: Number },
      ],
      data: [
        ["Liabilities:Credit-Card", 1],
        ["Assets:Bank:Checking", 1],
        ["Expenses:Restaurant", 2],
      ],
    },
    // GROUP-BY: 'account' is invisible.
    // ORDER-BY: 'len(account)' is a non-aggregate and visible.
    {
      source: NON_AGGREGATE_QUERY,
      input: `
          SELECT length(account) as len, sum(position) as amount
          GROUP BY account, len
          ORDER BY len;
      `,
      columns: [
        { name: "len", type: Number },
        { name: "amount", type: Inventory },
      ],
      data: [
        [19, new Inventory([new Position(new Amount("-100.00", "USD"))])],
        [20, new Inventory([new Position(new Amount("100.00", "USD"))])],
      ],
    },
    // GROUP-BY: 'account' is invisible.
    // ORDER-BY: 'sum(number)' is an aggregate and invisible.
    {
      source: `
        2010-02-21 * "First"
          Assets:Bank:Checking       -1.00 USD
          Expenses:Restaurant         1.00 USD

        2010-02-23 * "Second"
          Liabilities:Credit-Card    -2.00 USD
          Expenses:Restaurant         2.00 USD
      `,
      input: `
          SELECT count(account) as num
          GROUP BY account
          ORDER BY sum(number);
      `,
      columns: [{ name: "num", type: Number }],
      data: [[1], [1], [2]],
    },
    // GROUP-BY: 'account' is invisible.
    // ORDER-BY: 'sum(account)' is an aggregate and visible.
    {
      source: `
        2010-02-21 * "First"
          Assets:Bank:Checking       -1.00 USD
          Expenses:Restaurant         1.00 USD

        2010-02-23 * "Second"
          Liabilities:Credit-Card    -2.00 USD
          Expenses:Restaurant         2.00 USD
      `,
      input: `
          SELECT count(account) as num, sum(number) as sum
          GROUP BY account
          ORDER BY sum(number);
      `,
      columns: [
        { name: "num", type: Number },
        { name: "sum", type: Decimal },
      ],
      data: [
        [1, new Decimal("-2.00")],
        [1, new Decimal("-1.00")],
        [2, new Decimal("3.00")],
      ],
    },
    //
    {
      source: `
        2010-02-21 * "First"
          Assets:Bank:Checking       -1.00 USD
          Expenses:Foo                1.00 USD

        2010-02-23 * "Second"
          Liabilities:Credit-Card    -2.00 USD
          Expenses:Bar                2.00 USD
      `,
      input: `
          SELECT account, sum(number)
          GROUP BY account
          HAVING sum(number) > 0.0
          ORDER BY account
      `,
      columns: [
        { name: "account", type: Account },
        { name: "sum(number)", type: Decimal },
      ],
      data: [
        ["Expenses:Bar", new Decimal("2.00")],
        ["Expenses:Foo", new Decimal("1.00")],
      ],
    },
  ],
  "Execute Options": [
    // Order by ASC
    {
      source: `
        2010-02-23 *
        Assets:AssetA       5.00 USD
        Assets:AssetD       2.00 USD
        Assets:AssetB       4.00 USD
        Assets:AssetC       3.00 USD
        Assets:AssetE       1.00 USD
        Equity:Rest       -15.00 USD
      `,
      input: [
        "SELECT account, number ORDER BY number;",
        "SELECT account, number ORDER BY number ASC;",
      ],
      columns: [
        { name: "account", type: Account },
        { name: "number", type: Decimal },
      ],
      data: [
        ["Equity:Rest", new Decimal("-15.00")],
        ["Assets:AssetE", new Decimal("1.00")],
        ["Assets:AssetD", new Decimal("2.00")],
        ["Assets:AssetC", new Decimal("3.00")],
        ["Assets:AssetB", new Decimal("4.00")],
        ["Assets:AssetA", new Decimal("5.00")],
      ],
    },
    // Order by Desc
    {
      source: `
        2010-02-23 *
        Assets:AssetA       5.00 USD
        Assets:AssetD       2.00 USD
        Assets:AssetB       4.00 USD
        Assets:AssetC       3.00 USD
        Assets:AssetE       1.00 USD
        Equity:Rest       -15.00 USD
      `,
      input: ["SELECT account, number ORDER BY number DESC;"],
      columns: [
        { name: "account", type: Account },
        { name: "number", type: Decimal },
      ],
      data: [
        ["Assets:AssetA", new Decimal("5.00")],
        ["Assets:AssetB", new Decimal("4.00")],
        ["Assets:AssetC", new Decimal("3.00")],
        ["Assets:AssetD", new Decimal("2.00")],
        ["Assets:AssetE", new Decimal("1.00")],
        ["Equity:Rest", new Decimal("-15.00")],
      ],
    },
    // DISTINCT
    {
      source: `
         2010-02-23 *
            Assets:AssetA       5.00 USD
            Assets:AssetA       2.00 USD
            Assets:AssetA       4.00 USD
            Equity:Rest
      `,
      input: ["SELECT account"],
      columns: [{ name: "account", type: Account }],
      data: [
        ["Assets:AssetA"],
        ["Assets:AssetA"],
        ["Assets:AssetA"],
        ["Equity:Rest"],
      ],
    },
    {
      source: `
         2010-02-23 *
            Assets:AssetA       5.00 USD
            Assets:AssetA       2.00 USD
            Assets:AssetA       4.00 USD
            Equity:Rest
      `,
      input: ["SELECT DISTINCT account"],
      columns: [{ name: "account", type: Account }],
      data: [["Assets:AssetA"], ["Equity:Rest"]],
    },
    // LIMIT
    {
      source: `
        2010-02-23 *
        Assets:AssetA       5.00 USD
        Assets:AssetD       2.00 USD
        Assets:AssetB       4.00 USD
        Assets:AssetC       3.00 USD
        Assets:AssetE       1.00 USD
        Equity:Rest       -15.00 USD
      `,
      input: ["SELECT account, number ORDER BY number LIMIT 3"],
      columns: [
        { name: "account", type: Account },
        { name: "number", type: Decimal },
      ],
      data: [
        ["Equity:Rest", new Decimal("-15.00")],
        ["Assets:AssetE", new Decimal("1.00")],
        ["Assets:AssetD", new Decimal("2.00")],
      ],
    },
  ],
  "Order By": [
    {
      source: `
        2022-03-28 * "Test"
          Assets:Tests  1.00 USD
            aa: 1
            bb: 1
          Assets:Tests  2.00 USD
            aa: 1
            bb: 2
          Assets:Tests  3.00 USD
            aa: 2
          Assets:Tests  4.00 USD
            aa: 2
            bb: 1
          Expenses:Tests
      `,
      input: `
        SELECT account, meta('aa') AS a, meta('bb') AS b ORDER BY 2, 3
      `,
      columns: [
        { name: "account", type: Account },
        { name: "a", type: Object },
        { name: "b", type: Object },
      ],
      data: [
        ["Expenses:Tests", null, null],
        ["Assets:Tests", new Decimal(1), new Decimal(1)],
        ["Assets:Tests", new Decimal(1), new Decimal(2)],
        ["Assets:Tests", new Decimal(2), null],
        ["Assets:Tests", new Decimal(2), new Decimal(1)],
      ],
    },
    {
      source: `
        2022-03-28 * "Test"
          Assets:Tests  1.00 USD
            aa: 1
            bb: 1
          Assets:Tests  2.00 USD
            aa: 1
            bb: 2
          Assets:Tests  3.00 USD
            aa: 2
          Assets:Tests  4.00 USD
            aa: 2
            bb: 1
          Expenses:Tests
      `,
      input: `
        SELECT account, meta('aa') AS a, meta('bb') AS b ORDER BY 2, 3 DESC
      `,
      columns: [
        { name: "account", type: Account },
        { name: "a", type: Object },
        { name: "b", type: Object },
      ],
      data: [
        ["Expenses:Tests", null, null],
        ["Assets:Tests", new Decimal(1), new Decimal(2)],
        ["Assets:Tests", new Decimal(1), new Decimal(1)],
        ["Assets:Tests", new Decimal(2), new Decimal(1)],
        ["Assets:Tests", new Decimal(2), null],
      ],
    },
    {
      source: `
        2022-03-28 * "Test"
          Assets:Tests  1.00 USD
            aa: 1
            bb: 1
          Assets:Tests  2.00 USD
            aa: 1
            bb: 2
          Assets:Tests  3.00 USD
            aa: 2
          Assets:Tests  4.00 USD
            aa: 2
            bb: 1
          Expenses:Tests
      `,
      input: `
        SELECT account, meta('aa') AS a, meta('bb') AS b ORDER BY 2 DESC, 3
      `,
      columns: [
        { name: "account", type: Account },
        { name: "a", type: Object },
        { name: "b", type: Object },
      ],
      data: [
        ["Assets:Tests", new Decimal(2), null],
        ["Assets:Tests", new Decimal(2), new Decimal(1)],
        ["Assets:Tests", new Decimal(1), new Decimal(1)],
        ["Assets:Tests", new Decimal(1), new Decimal(2)],
        ["Expenses:Tests", null, null],
      ],
    },
  ],
  "Arithmetic Functions": [
    {
      source: `
        2010-02-23 *
          Assets:Something       5.00 USD
      `,
      input: `
        SELECT number + 3 as result
      `,
      columns: [{ name: "result", type: Decimal }],
      data: [[new Decimal("8.00")]],
    },
    {
      source: `
        2010-02-23 *
          Assets:Something       5.00 USD
      `,
      input: `
        SELECT number * 1.2 as result
      `,
      columns: [{ name: "result", type: Decimal }],
      data: [[new Decimal("6.00")]],
    },
    {
      source: `
        2010-02-23 *
          Assets:Something       5.00 USD
      `,
      input: `
        SELECT number / 2 as result
      `,
      columns: [{ name: "result", type: Decimal }],
      data: [[new Decimal("2.50")]],
    },
    {
      source: `
        2010-02-23 *
          Assets:Something       5.00 USD
      `,
      input: `
        SELECT number / 0 as result
      `,
      columns: [{ name: "result", type: Decimal }],
      data: [[null]],
    },
  ],
  "Sub Query": [
    {
      source: `
        2010-02-23 *
          Assets:Something       5.00 USD
      `,
      input: [
        "SELECT a + 2 AS b FROM (SELECT 3 AS a)",
        "SELECT a + 2 AS b FROM (SELECT 3 AS a FROM #)",
      ],
      columns: [{ name: "b", type: INTEGER }],
      data: [[5]],
    },
    {
      source: `
        2000-01-01 open Income:Contributions:One
        2000-01-01 open Income:Contributions:Two
        2000-01-01 open Income:Contributions:Three
        2000-01-01 open Assets:Cash

        2024-10-25 * "One"
          Income:Contributions:One                            100.00 USD
          Assets:Cash

        2024-10-26 * "Two"
          Income:Contributions:Two                             10.00 USD
          Assets:Cash

        2024-10-27 * "Three"
          Income:Contributions:Three                           50.00 USD
          Assets:Cash

        2024-10-28 * "Three"
          Income:Contributions:Three                            1.00 USD
          Assets:Cash
      `,
      input: `
          SELECT account
          FROM #postings
          GROUP BY account
          HAVING number(only('USD', sum(position))) > 50.0
      `,
      columns: [{ name: "account", type: Account }],
      data: [["Income:Contributions:One"], ["Income:Contributions:Three"]],
    },
    {
      source: `
        2000-01-01 open Income:Contributions:One
        2000-01-01 open Income:Contributions:Two
        2000-01-01 open Income:Contributions:Three
        2000-01-01 open Assets:Cash

        2024-10-25 * "One"
          Income:Contributions:One                            100.00 USD
          Assets:Cash

        2024-10-26 * "Two"
          Income:Contributions:Two                             10.00 USD
          Assets:Cash

        2024-10-27 * "Three"
          Income:Contributions:Three                           50.00 USD
          Assets:Cash

        2024-10-28 * "Three"
          Income:Contributions:Three                            1.00 USD
          Assets:Cash
      `,
      input: `
        SELECT
          account,
          date
        FROM #postings
        WHERE root(account, 2) = 'Income:Contributions'
        ORDER BY date
      `,
      columns: [
        { name: "account", type: Account },
        { name: "date", type: DateTime },
      ],
      data: [
        [
          "Income:Contributions:One",
          DateTime.fromObject(
            { year: 2024, month: 10, day: 25 },
            { zone: "utc" },
          ),
        ],
        [
          "Income:Contributions:Two",
          DateTime.fromObject(
            { year: 2024, month: 10, day: 26 },
            { zone: "utc" },
          ),
        ],
        [
          "Income:Contributions:Three",
          DateTime.fromObject(
            { year: 2024, month: 10, day: 27 },
            { zone: "utc" },
          ),
        ],
        [
          "Income:Contributions:Three",
          DateTime.fromObject(
            { year: 2024, month: 10, day: 28 },
            { zone: "utc" },
          ),
        ],
      ],
    },
    {
      source: `
        2000-01-01 open Income:Contributions:One
        2000-01-01 open Income:Contributions:Two
        2000-01-01 open Income:Contributions:Three
        2000-01-01 open Assets:Cash

        2024-10-25 * "One"
          Income:Contributions:One                            100.00 USD
          Assets:Cash

        2024-10-26 * "Two"
          Income:Contributions:Two                             10.00 USD
          Assets:Cash

        2024-10-27 * "Three"
          Income:Contributions:Three                           50.00 USD
          Assets:Cash

        2024-10-28 * "Three"
          Income:Contributions:Three                            1.00 USD
          Assets:Cash
      `,
      input: `
        SELECT
          account,
          date
        FROM #postings
        WHERE root(account, 2) = 'Income:Contributions'
        AND account IN (
          SELECT account
          FROM #postings
          GROUP BY account
          HAVING number(only('USD', sum(position))) > 50.0
        )
        ORDER BY date
      `,
      columns: [
        { name: "account", type: Account },
        { name: "date", type: DateTime },
      ],
      data: [
        [
          "Income:Contributions:One",
          DateTime.fromObject(
            { year: 2024, month: 10, day: 25 },
            { zone: "utc" },
          ),
        ],
        [
          "Income:Contributions:Three",
          DateTime.fromObject(
            { year: 2024, month: 10, day: 27 },
            { zone: "utc" },
          ),
        ],
        [
          "Income:Contributions:Three",
          DateTime.fromObject(
            { year: 2024, month: 10, day: 28 },
            { zone: "utc" },
          ),
        ],
      ],
    },
  ],
  "Array Ops": [
    {
      source: ARRAY_OPS,
      input: `
          SELECT date
          FROM #entries
          WHERE 'Expenses:Two' IN accounts
      `,
      columns: [{ name: "date", type: DateTime }],
      data: [
        [
          DateTime.fromObject(
            { year: 2000, month: 1, day: 2 },
            { zone: "utc" },
          ),
        ],
        [
          DateTime.fromObject(
            { year: 2025, month: 1, day: 2 },
            { zone: "utc" },
          ),
        ],
      ],
    },
    {
      source: ARRAY_OPS,
      input: [
        `
            SELECT date, narration
            FROM #transactions
            WHERE 'Expenses:Two' IN accounts
        `,
        `
          SELECT date, narration
          FROM #transactions
           WHERE ':Two' ?~ ANY(accounts)
        `,
        `
          SELECT date, narration
          FROM #transactions
          WHERE ':two|:cash' ?~* ALL(accounts)
        `,
        `
          SELECT date, narration
          FROM #transactions
          WHERE '(?i):two|:cash' ?~* ALL(accounts)
        `,
      ],
      columns: [
        { name: "date", type: DateTime },
        { name: "narration", type: String },
      ],
      data: [
        [
          DateTime.fromObject(
            { year: 2025, month: 1, day: 2 },
            { zone: "utc" },
          ),
          "Two",
        ],
      ],
    },
  ],
  "Array Ops SubQuery": [
    {
      source: `2010-02-23 open Assets:Something`,
      input: [
        `SELECT 1 IN (SELECT x FROM #test) AS y FROM #`,
        "SELECT 1 = ANY (SELECT x FROM #test) AS y FROM #",
        "SELECT 1 = ALL (SELECT x FROM #test WHERE x = 1) AS y FROM #",
      ],
      columns: [{ name: "y", type: Boolean }],
      data: [[true]],
    },
    {
      source: `2010-02-23 open Assets:Something`,
      input: [
        `SELECT 1 IN (SELECT x FROM #test  WHERE x % 2 = 0) AS y FROM #`,
        "SELECT 1 = ANY (SELECT x FROM #test WHERE x % 2 = 0) AS y FROM #",
        "SELECT 1 = ALL (SELECT x FROM #test) AS y FROM #",
      ],
      columns: [{ name: "y", type: Boolean }],
      data: [[false]],
    },
  ],
  "Execute Pivot": [
    {
      source: PIVOT_OPS,
      input: [
        `
          SELECT
            account,
            year(date) AS year,
            sum(cost(position)) AS balance
          WHERE
            account ~ 'Expenses'
          GROUP BY 1, 2
          PIVOT BY 1, 2
        `,
        `
        SELECT
          account,
          year(date) AS year,
          sum(cost(position)) AS balance
        WHERE
          account ~ 'Expenses'
        GROUP BY 1, 2
        PIVOT BY account, year
      `,
      ],
      columns: [
        { name: "account/year", type: Account },
        { name: "2012", type: Inventory },
        { name: "2013", type: Inventory },
        { name: "2014", type: Inventory },
        { name: "2015", type: Inventory },
      ],
      data: [
        [
          "Expenses:Aaa",
          new Inventory(new Position(new Amount("5.00", "USD"))),
          new Inventory(new Position(new Amount("4.00", "USD"))),
          new Inventory(new Position(new Amount("6.00", "USD"))),
          new Inventory(new Position(new Amount("8.00", "USD"))),
        ],
        [
          "Expenses:Bbb",
          new Inventory(new Position(new Amount("1.00", "USD"))),
          new Inventory(new Position(new Amount("7.00", "USD"))),
          new Inventory(new Position(new Amount("5.00", "USD"))),
          null,
        ],
      ],
    },
    {
      source: PIVOT_OPS,
      input: [
        `
          SELECT
              account,
              year(date) AS year,
              sum(cost(position)) AS balance,
              last(date) AS updated
            WHERE
              account ~ 'Expenses' AND
              year >= 2014
            GROUP BY 1, 2
            PIVOT BY 1, 2
        `,
      ],
      columns: [
        { name: "account/year", type: Account },
        { name: "2014/balance", type: Inventory },
        { name: "2014/updated", type: DateTime },
        { name: "2015/balance", type: Inventory },
        { name: "2015/updated", type: DateTime },
      ],
      data: [
        [
          "Expenses:Aaa",
          new Inventory(new Position(new Amount("6.00", "USD"))),
          DateTime.fromObject(
            { year: 2014, month: 3, day: 3 },
            { zone: "utc" },
          ),
          new Inventory(new Position(new Amount("8.00", "USD"))),
          DateTime.fromObject(
            { year: 2015, month: 4, day: 4 },
            { zone: "utc" },
          ),
        ],
        [
          "Expenses:Bbb",
          new Inventory(new Position(new Amount("5.00", "USD"))),
          DateTime.fromObject(
            { year: 2014, month: 2, day: 2 },
            { zone: "utc" },
          ),
          null,
          null,
        ],
      ],
    },
  ],
  "beanquery/issues/189": [
    {
      source: `
      plugin "beancount.plugins.auto_accounts"

      2024-06-16 * "Example"
        Assets:Foo                                        -1000.00 EUR
        Assets:Foo                                         
        Expenses:Bar                                          2.00 EUR

      2024-06-17 * "Example"
        Assets:Foo                                           -1.00 EUR
        Expenses:Bar
      `,
      input: `SELECT date, balance WHERE account = 'Assets:Foo' ORDER BY balance ASC LIMIT 1`,
      data: [
        [
          DateTime.fromObject(
            { year: 2024, month: 6, day: 16 },
            { zone: "utc" },
          ),
          new Inventory(new Position(new Amount("-1000.00", "EUR"))),
        ],
      ],
    },
    {
      source: `
      plugin "beancount.plugins.auto_accounts"

      2024-06-16 * "Example"
        Assets:Foo                                        -1000.00 EUR
        Assets:Foo                                         
        Expenses:Bar                                          2.00 EUR

      2024-06-17 * "Example"
        Assets:Foo                                           -1.00 EUR
        Expenses:Bar
      `,
      input: `SELECT date, sum(position) OVER (ORDER BY date) AS balance WHERE account = 'Assets:Foo' ORDER BY balance ASC`,
      columns: [
        { name: "date", type: DateTime },
        { name: "balance", type: Inventory },
      ],
      data: [
        [
          DateTime.fromObject(
            { year: 2024, month: 6, day: 16 },
            { zone: "utc" },
          ),
          new Inventory(new Position(new Amount("-2.00", "EUR"))),
        ],
        [
          DateTime.fromObject(
            { year: 2024, month: 6, day: 16 },
            { zone: "utc" },
          ),
          new Inventory(new Position(new Amount("-2.00", "EUR"))),
        ],
        [
          DateTime.fromObject(
            { year: 2024, month: 6, day: 17 },
            { zone: "utc" },
          ),
          new Inventory(new Position(new Amount("-3.00", "EUR"))),
        ],
      ],
    },
  ],
};

function filterEntries(query: EvalQuery) {
  const entries = new Set<DirectiveBase>();
  const where = query.where;
  for (const entry of query.table) {
    if (isNull(where) || where.resolve(entry)) {
      if (entry instanceof DirectiveBase) {
        entries.add(entry);
      }
    }
  }
  return sorted([...entries]);
}

function assertEqualEntries(input: string, directives: DirectiveBase[]) {
  const [inputDirectives] = loadString(input);
  expect(inputDirectives.map((it) => it.toString()).sort()).toEqual(
    directives.map((it) => it.toString()).sort(),
  );
}

for (const [key, cases] of Object.entries(testCases)) {
  describe(key, () => {
    cases.forEach((testCase) => {
      const tests = Array.isArray(testCase.input)
        ? testCase.input
        : [testCase.input];
      tests.forEach((input) => {
        test(`${input}`, () => {
          const context = createDatabase(testCase.source);
          context.tables.set(
            "test",
            Table.create("test", new AttributeColumn("x", Number)).data(
              Array.from({ length: 16 }).map((_, index) => ({ x: index + 1 })),
            ),
          );
          const [columns, resultSet] = context.execute(input);
          if (testCase.columns) {
            expect(normalizeColumns(columns)).toEqual(testCase.columns);
          }
          if (testCase.data !== undefined) {
            expect(resultSet).toEqual(
              Array.isArray(testCase.data) ? testCase.data : [[testCase.data]],
            );
          }
        });
      });
    });
  });
}

describe("Filter Entries", () => {
  const context = createDatabase(COMMON_INPUT);
  const compiler = new Compiler(context, { defaultTableName: "entries" });

  [
    {
      query: `SELECT *`,
      expected: COMMON_INPUT,
    },
    {
      query: `SELECT date, type FROM year(date) = 2012;`,
      expected: `
          2012-02-02 * "Dinner with Dos"
            Assets:Bank:Checking              102.00 USD
            Expenses:Restaurant              -102.00 USD
      `,
    },
    {
      query: `
          SELECT date, type
          FROM NOT (type = 'transaction' AND
                    (year(date) = 2012 OR year(date) = 2013));
      `,
      expected: `
          2010-01-01 open Assets:Bank:Checking
          2010-01-01 open Assets:Bank:Savings
          2010-01-01 open Expenses:Restaurant
          2010-01-01 open Assets:ForeignBank:Checking

          2010-01-01 * "Dinner with Cero"
            Assets:Bank:Checking              100.00 USD
            Expenses:Restaurant              -100.00 USD

          2011-01-01 * "Dinner with Uno"
            Assets:Bank:Checking              101.00 USD
            Expenses:Restaurant              -101.00 USD

          2014-04-04 * "Dinner with Quatro"
            Assets:Bank:Checking              104.00 USD
            Expenses:Restaurant              -104.00 USD
      `,
    },
    {
      query: `SELECT date, type FROM date < 2012-06-01;`,
      expected: `
          2010-01-01 open Assets:Bank:Checking
          2010-01-01 open Assets:Bank:Savings
          2010-01-01 open Expenses:Restaurant
          2010-01-01 open Assets:ForeignBank:Checking

          2010-01-01 * "Dinner with Cero"
            Assets:Bank:Checking              100.00 USD
            Expenses:Restaurant              -100.00 USD

          2011-01-01 * "Dinner with Uno"
            Assets:Bank:Checking              101.00 USD
            Expenses:Restaurant              -101.00 USD

          2012-02-02 * "Dinner with Dos"
            Assets:Bank:Checking              102.00 USD
            Expenses:Restaurant              -102.00 USD
      `,
    },
    {
      query: `
        SET close = 2013-06-01;
        SELECT date, type;
      `,
      expected: `
          2010-01-01 open Assets:Bank:Checking
          2010-01-01 open Assets:ForeignBank:Checking
          2010-01-01 open Assets:Bank:Savings

          2010-01-01 open Expenses:Restaurant

          2010-01-01 * "Dinner with Cero"
            Assets:Bank:Checking       100.00 USD
            Expenses:Restaurant       -100.00 USD

          2011-01-01 * "Dinner with Uno"
            Assets:Bank:Checking       101.00 USD
            Expenses:Restaurant       -101.00 USD

          2012-02-02 * "Dinner with Dos"
            Assets:Bank:Checking       102.00 USD
            Expenses:Restaurant       -102.00 USD

          2013-03-03 * "Dinner with Tres"
            Assets:Bank:Checking       103.00 USD
            Expenses:Restaurant       -103.00 USD
      `,
    },
    {
      query: `SELECT date, type FROM CLOSE ON 2013-06-01`,
      expected: `
          2010-01-01 open Assets:Bank:Checking
          2010-01-01 open Assets:ForeignBank:Checking
          2010-01-01 open Assets:Bank:Savings

          2010-01-01 open Expenses:Restaurant

          2010-01-01 * "Dinner with Cero"
            Assets:Bank:Checking       100.00 USD
            Expenses:Restaurant       -100.00 USD

          2011-01-01 * "Dinner with Uno"
            Assets:Bank:Checking       101.00 USD
            Expenses:Restaurant       -101.00 USD

          2012-02-02 * "Dinner with Dos"
            Assets:Bank:Checking       102.00 USD
            Expenses:Restaurant       -102.00 USD

          2013-03-03 * "Dinner with Tres"
            Assets:Bank:Checking       103.00 USD
            Expenses:Restaurant       -103.00 USD
      `,
    },
    {
      query: `SELECT date, type FROM OPEN ON 2013-01-01`,
      expected: `
          2010-01-01 open Assets:Bank:Checking
          2010-01-01 open Assets:Bank:Savings
          2010-01-01 open Expenses:Restaurant
          2010-01-01 open Assets:ForeignBank:Checking

          2012-12-31 S "Opening balance for 'Assets:Bank:Checking' (Summarization)"
            Assets:Bank:Checking          303.00 USD
            Equity:Opening-Balances      -303.00 USD

          2012-12-31 S "Opening balance for 'Equity:Earnings:Previous' (Summarization)"
            Equity:Earnings:Previous     -303.00 USD
            Equity:Opening-Balances       303.00 USD

          2013-03-03 * "Dinner with Tres"
            Assets:Bank:Checking          103.00 USD
            Expenses:Restaurant          -103.00 USD

          2013-10-10 * "International Transfer"
            Assets:Bank:Checking          -50.00 USD            ; -50.00 USD
            Assets:ForeignBank:Checking   -60.00 CAD @ 1.20 USD ; -72.00 USD

          2014-04-04 * "Dinner with Quatro"
            Assets:Bank:Checking          104.00 USD
            Expenses:Restaurant          -104.00 USD
      `,
    },
    {
      query: `SELECT date, type FROM CLEAR`,
      expected:
        COMMON_INPUT +
        `
       2014-04-04 T "Transfer balance for 'Expenses:Restaurant' (Transfer balance)"
            Expenses:Restaurant                                 510.00 USD
            Equity:Earnings:Current                            -510.00 USD
      `,
    },
    {
      query: `SELECT date, type FROM CLOSE`,
      expected:
        COMMON_INPUT +
        `
        2014-04-04 C "Conversion for (-50.00 USD, -60.00 CAD)"
            Equity:Conversions:Current  50.00 USD @ 0 NOTHING
            Equity:Conversions:Current  60.00 CAD @ 0 NOTHING
      `,
    },
  ].forEach((testCase) => {
    test(testCase.query, () => {
      const [query, errors, options] = context.prepare(testCase.query);
      expect(errors).toEqual([]);
      const filter = compiler.compile(query, null, options) as EvalQuery;
      const entries = filterEntries(filter);
      assertEqualEntries(testCase.expected, entries);
    });
  });
});

describe("Invalid Queries", () => {
  test("Invalid where expression", () => {
    const context = new Context().withTables(
      Table.create(
        "postings",
        new AttributeColumn("a", Number),
        new AttributeColumn("b", String),
      ).data([
        { a: "a", b: "one" },
        { a: "a", b: "two" },
        { a: "a", b: "three" },
        { a: "b", b: "four" },
        { a: "c", b: "five" },
        { a: "c", b: "six" },
      ]),
    );
    expect(() =>
      context.execute("SELECT * WHERE 'Income:US:Hoogle:Vacation'"),
    ).toThrowError("argument of WHERE must be type boolean, not type string");
    expect(() =>
      context.execute("SELECT * WHERE 'Income:US:Hoogle:Vacation' AND 23"),
    ).toThrowError("argument of AND must be type boolean, not type string");
    expect(() =>
      context.execute("SELECT * WHERE 'Income:US:Hoogle:Vacation' OR 23"),
    ).toThrowError("argument of OR must be type boolean, not type string");
    expect(() =>
      context.execute("SELECT * WHERE NOT 'Income:US:Hoogle:Vacation'"),
    ).toThrowError("argument of NOT must be type boolean, not type string");
  });
});

describe("Create Table", () => {
  test("create", () => {
    const context = new Context();
    const [columns, data] = context.execute(
      "CREATE TABLE abcd (a int, b bool, c str, d date)",
    );
    expect(data).toEqual([]);
    expect(normalizeColumns(columns)).toEqual([
      { name: "a", type: INTEGER },
      { name: "b", type: Boolean },
      { name: "c", type: String },
      { name: "d", type: DateTime },
    ]);
    expect([...context.tables.get("abcd").columns.keys()]).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(
      [...context.tables.get("abcd").columns.values()].map((it) => it.type),
    ).toEqual([INTEGER, Boolean, String, DateTime]);
  });

  test("create AS", () => {
    const context = new Context();
    context.execute("CREATE TABLE abc (a int, b bool, c str)");
    context.execute(`
       INSERT INTO abc (a, b, c) VALUES
       (1, true, '2025/01/01'),
       (2, false, '2025/02/01')
      `);
    const [columns, data] = context.execute(
      `CREATE TABLE test AS SELECT a, parse_date(c, 'yyyy/MM/dd') AS date FROM abc`,
    );
    expect(normalizeColumns(columns)).toEqual([
      { name: "a", type: INTEGER },
      { name: "date", type: DateTime },
    ]);
    expect(data).toEqual([
      [1, DateTime.fromObject({ year: 2025, month: 1, day: 1 })],
      [2, DateTime.fromObject({ year: 2025, month: 2, day: 1 })],
    ]);
  });
});
