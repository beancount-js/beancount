import { describe, test, expect } from "vitest";
import { LedgerSource } from "../core/ledger-data";
import defaultLedger from "../fixtures/default.beancount?raw";
import { LedgerDatabase } from "./db";
import alasql from "alasql";

alasql.options.cache = false;

describe("DB", () => {
  const ledgerSource = new LedgerSource(defaultLedger);
  test("query", () => {
    expect(ledgerSource.errors).toEqual([]);
    const db = new LedgerDatabase(ledgerSource.data);
    const queries: Array<{ query: string; expected: any }> = [
      {
        query: `
                    SELECT 
                        account,
                        currency
                    FROM transactions
                    WHERE account_sortkey(account) ~ "^[01]" and number > 0
                    GROUP BY account, cost_currency, account_sortkey(account), currency
                    ORDER BY account_sortkey(account), currency
                `,
        expected: [],
      },
      {
        query: `
                    SELECT date, narration, account, position, abs(number)
                    WHERE account ~ ".*:Vacation" AND year >= 2014 AND number = -5
                `,
        expected: [],
      },
      {
        query: `
                    SELECT last(date) as last_date, cost(sum(position)) as cost
                `,
        expected: [],
      },
      {
        query: `
                    SELECT * WHERE 'age:x:y' = ANY(other_accounts) LIMIT 1
                `,
        expected: [],
      },
    ];

    [queries[3]].forEach((q) => {
      console.log(db.query(q.query));
    });
  });
});
