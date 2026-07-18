import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { loadString } from "@beancount-js/beancount";
import { runBql } from "..";

const sampleBudgets = resolve(
  import.meta.dirname,
  "../../../../sample-budgets.beancount",
);

/** Mirrors Fava Holdings → Holdings by Account (unrealized_profit_pct uses sum(number(value(...)))). */
const holdingsByAccount = `
SELECT account,
    units(sum(position)) AS units,
    cost(sum(position)) AS book_value,
    value(sum(position)) AS market_value,
    safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 AS unrealized_profit_pct
WHERE account_sortkey(account) ~ '^[01]'
GROUP BY account, cost_currency, account_sortkey(account), currency
ORDER BY account_sortkey(account), currency
`;

describe("holdings-by-account sum(null) parity", () => {
  test("sum ignores NULL decimal operands (upstream beanquery)", () => {
    // Zero-unit positions make value(position) NULL via convertInventory;
    // sum(number(value(position))) must still run (SQL/beanquery skip NULLs).
    const ledger = `
      2020-01-01 open Assets:Cash USD
      2020-01-01 open Assets:IRA IRAUSD
      2020-01-01 open Equity:Opening-Balances
      2020-01-02 * "Fund"
        Assets:Cash 100 USD
        Equity:Opening-Balances -100 USD
      2020-01-03 * "Zero IRA lot"
        Assets:IRA 0 IRAUSD
        Equity:Opening-Balances 0 IRAUSD
    `;
    const [dirs, errors, options] = loadString(ledger);
    const result = runBql(
      dirs,
      `SELECT sum(number(value(position))) WHERE account ~ '^Assets'`,
      { errors, options },
    );
    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(1);
  });

  test.skipIf(!existsSync(sampleBudgets))(
    "runs Fava holdings-by-account on sample-budgets.beancount",
    () => {
      const [dirs, errors, options] = loadString(
        readFileSync(sampleBudgets, "utf8"),
      );
      const result = runBql(dirs, holdingsByAccount, { errors, options });
      expect(result.error).toBeUndefined();
      expect(result.data.length).toBeGreaterThan(0);
    },
  );
});
