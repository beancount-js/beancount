<script lang="ts">
  import PresetQueryView from "./PresetQueryView.svelte";
  const queries: Array<{
    id: string;
    name: string;
    query: string;
  }> = [
    {
      id: "holdings",
      name: "Holdings",
      query: `
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
    },
    {
      id: "holdings-by-account",
      name: "Holdings by Account",
      query: `
            SELECT account,
                units(sum(position)) AS units,
                cost(sum(position)) AS book_value,
                value(sum(position)) AS market_value,
                safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 AS unrealized_profit_pct
            WHERE account_sortkey(account) ~ '^[01]'
            GROUP BY account, cost_currency, account_sortkey(account), currency
            ORDER BY account_sortkey(account), currency
            `,
    },
    {
      id: "holdings-by-currency",
      name: "Holdings by Currency",
      query: `
            SELECT
                units(sum(position)) AS units,
                safediv(number(only(first(cost_currency), cost(sum(position)))), number(only(first(currency), units(sum(position))))) AS average_cost,
                cost(sum(position)) AS book_value,
                value(sum(position)) AS market_value,
                safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 AS unrealized_profit_pct
            WHERE account_sortkey(account) ~ '^[01]'
            GROUP BY currency, cost_currency
            ORDER BY currency, cost_currency
            `,
    },
    {
      id: "holdings-by-cost-currency",
      name: "Holdings by Cost currency",
      query: `
            SELECT cost_currency,
                units(sum(position)) AS units,
                cost(sum(position)) AS book_value,
                value(sum(position)) AS market_value,
                safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 AS unrealized_profit_pct
            WHERE account_sortkey(account) ~ '^[01]'
            GROUP BY cost_currency
            ORDER BY cost_currency
            `,
    },
  ];
</script>

<PresetQueryView {queries} scrollTabs />
