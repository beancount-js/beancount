import { describe, expect, test } from "vitest";
import { loadString } from "@beancount-js/beancount";
import { Decimal } from "@beancount-js/parser";
import { runBql } from ".";

describe("runBql", () => {
  test("uses cost currencies as strings in price lookups", () => {
    const [directives, errors, options] = loadString(`
      option "operating_currency" "USD"

      2024-01-01 commodity HOOL
      2024-01-01 price HOOL 100 USD
      2024-01-01 open Assets:Investment HOOL
      2024-01-01 open Assets:Cash USD

      2024-01-02 * "Buy shares"
        Assets:Investment 1 HOOL {50 USD}
        Assets:Cash -50 USD
    `);

    const result = runBql(
      directives,
      `
        SELECT currency, cost_currency,
          getprice(currency, cost_currency) AS price
        FROM postings
        WHERE cost_currency = 'USD'
      `,
      { errors, options },
    );

    expect(result.error).toBeUndefined();
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      currency: "HOOL",
      cost_currency: "USD",
      price: new Decimal("100"),
    });
  });

  test("supports the enriched holdings report", () => {
    const [directives, errors, options] = loadString(`
      option "operating_currency" "USD"

      2024-01-01 commodity HOOL
      2024-01-01 price HOOL 100 USD
      2024-01-01 open Assets:Investment HOOL
      2024-01-01 open Assets:Cash USD

      2024-01-02 * "Buy shares"
        Assets:Investment 1 HOOL {50 USD}
        Assets:Cash -50 USD
    `);

    const queries = [
      `
        SELECT account,
          units(sum(position)) AS units,
          cost_number AS cost,
          first(getprice(currency, cost_currency)) AS price,
          cost(sum(position)) AS book_value,
          value(sum(position)) AS market_value,
          cost_date AS acquisition_date
        WHERE account_sortkey(account) ~ '^[01]'
        GROUP BY account, cost_date, currency, cost_currency, cost_number, account_sortkey(account)
        ORDER BY account_sortkey(account), currency, cost_date
      `,
      `
        SELECT account,
          units(sum(position)) AS units,
          cost(sum(position)) AS book_value,
          value(sum(position)) AS market_value,
          safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 AS unrealized_profit_pct
        WHERE account_sortkey(account) ~ '^[01]'
        GROUP BY account, cost_currency, account_sortkey(account), currency
        ORDER BY account_sortkey(account), currency
      `,
      `
        SELECT units(sum(position)) AS units,
          safediv(number(only(first(cost_currency), cost(sum(position)))), number(only(first(currency), units(sum(position))))) AS average_cost,
          cost(sum(position)) AS book_value,
          value(sum(position)) AS market_value,
          safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 AS unrealized_profit_pct
        WHERE account_sortkey(account) ~ '^[01]'
        GROUP BY currency, cost_currency
        ORDER BY currency, cost_currency
      `,
      `
        SELECT units(sum(position)) AS units,
          cost(sum(position)) AS book_value,
          value(sum(position)) AS market_value,
          safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 AS unrealized_profit_pct
        WHERE account_sortkey(account) ~ '^[01]'
        GROUP BY cost_currency
        ORDER BY cost_currency
      `,
    ];

    for (const query of queries) {
      const result = runBql(directives, query, { errors, options });

      expect(result.error).toBeUndefined();
      expect(result.data.length).toBeGreaterThan(0);
    }
  });

  test("expands the balances shell command", () => {
    const [directives, errors, options] = loadString(`
      1980-01-01 open Assets:Cash USD
      1980-01-01 open Equity:Opening-Balances USD
      2020-01-01 * "Seed"
        Assets:Cash                     100.00 USD
        Equity:Opening-Balances
    `);

    const result = runBql(directives, "balances", { errors, options });
    expect(result.error).toBeUndefined();
    expect(result.columns.map((column) => column.name)).toEqual([
      "account",
      "sum(position)",
    ]);
    expect(result.data.some((row) => row.account === "Assets:Cash")).toBe(true);
  });
});
