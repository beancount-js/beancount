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
                currency,
                sum(number) AS units,
                cost_number AS cost,
                cost_currency,
                cost_date AS acquisition_date
            FROM postings
            GROUP BY account, currency, cost_number, cost_currency, cost_date
            ORDER BY account, currency, cost_date
            `,
    },
    {
      id: "holdings-by-account",
      name: "Holdings by Account",
      query: `
            SELECT account,
                currency,
                sum(number) AS units
            FROM postings
            GROUP BY account, currency
            ORDER BY account, currency
            `,
    },
    {
      id: "holdings-by-currency",
      name: "Holdings by Currency",
      query: `
            SELECT currency,
                sum(number) AS units
            FROM postings
            GROUP BY currency
            ORDER BY currency
            `,
    },
    {
      id: "holdings-by-cost-currency",
      name: "Holdings by Cost currency",
      query: `
            SELECT cost_currency,
                sum(number) AS units
            FROM postings
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
</ContentScrollArea>
