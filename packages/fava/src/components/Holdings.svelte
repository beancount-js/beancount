<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import * as ScrollArea from "$lib/components/ui/scroll-area";
  import { urlFor } from "../helpers";
  import QueryTable from "./QueryTable.svelte";
  import ContentScrollArea from "./ContentScrollArea.svelte";
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
  let value: string = queries[0].id;
  function handleChange(id: string | undefined) {
    value = id || queries[0].id;
  }
</script>

<svelte:window bind:innerHeight />
<ContentScrollArea contentClass="scroll-container p-4">
  <Tabs.Root class="w-full" {value} onValueChange={handleChange}>
    <ScrollArea.Root orientation="horizontal" class="w-full">
      <div class="w-max pr-3">
        <Tabs.List>
          {#each queries as query}
            <Tabs.Trigger value={query.id}>{query.name}</Tabs.Trigger>
          {/each}
        </Tabs.List>
      </div>
    </ScrollArea.Root>
    {#each queries as query}
      <Tabs.Content value={query.id}>
        <Button
          variant="outline"
          size="sm"
          href={urlFor("/query", { qs: query.query.trim() })}>Query</Button
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
</ContentScrollArea>
