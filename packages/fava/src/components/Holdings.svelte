<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import { urlFor } from "../helpers";
  import QueryTable from "./QueryTable.svelte";
  let innerHeight = 500;
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
                units(sum(position)) as units,
                cost_number as cost,
                first(getprice(currency, cost_currency)) as price,
                cost(sum(position)) as book_value,
                value(sum(position)) as market_value,
                cost_date as acquisition_date
            WHERE account_sortkey(account) ~ "^[01]"
            GROUP BY account, cost_date, currency, cost_currency, cost_number, account_sortkey(account)
            ORDER BY account_sortkey(account), currency, cost_date
            `,
    },
    {
      id: "holdings-by-account",
      name: "Holdings by Account",
      query: `
            SELECT account,
                units(sum(position)) as units,
                cost(sum(position)) as book_value,
                value(sum(position)) as market_value,
                safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 as unrealized_profit_pct
            WHERE account_sortkey(account) ~ "^[01]"
            GROUP BY account, cost_currency, account_sortkey(account), currency
            ORDER BY account_sortkey(account), currency
            `,
    },
    {
      id: "holdings-by-currency",
      name: "Holdings by Currency",
      query: `
            SELECT
                units(sum(position)) as units,
                SAFEDIV(number(only(first(cost_currency), cost(sum(position)))), number(only(first(currency), units(sum(position))))) as average_cost,
                cost(sum(position)) as book_value,
                value(sum(position)) as market_value,
                safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 as unrealized_profit_pct
            WHERE account_sortkey(account) ~ "^[01]"
            GROUP BY currency, cost_currency
            ORDER BY currency, cost_currency
            `,
    },
    {
      id: "holdings-by-cost-currency",
      name: "Holdings by Cost currency",
      query: `
            SELECT
                units(sum(position)) as units,
                cost(sum(position)) as book_value,
                value(sum(position)) as market_value,
                safediv((abs(sum(number(value(position)))) - abs(sum(number(cost(position))))), sum(number(cost(position)))) * 100 as unrealized_profit_pct
            WHERE account_sortkey(account) ~ "^[01]"
            GROUP BY cost_currency
            ORDER BY cost_currency
            `,
    },
  ];
  let value: string = queries[0].id;
  function handleChange(id: string | undefined) {
    value = id || queries[0].id;
  }
</script>

<svelte:window bind:innerHeight />
<div class="scroll-container no-bars p-4">
  <Tabs.Root class="w-full overflow-auto" {value} onValueChange={handleChange}>
    <div class="max-w-max">
      <Tabs.List>
        {#each queries as query}
          <Tabs.Trigger value={query.id}>{query.name}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </div>
    {#each queries as query}
      <Tabs.Content value={query.id}>
        <Button
          variant="outline"
          size="sm"
          href={urlFor("/query", { qs: query.query })}>Query</Button
        >
        {#if value === query.id}
          <QueryTable
            query={query.query}
            height={innerHeight - 250}
            padding={(innerHeight - 250) / 2}
          />
        {/if}
      </Tabs.Content>
    {/each}
  </Tabs.Root>
</div>
