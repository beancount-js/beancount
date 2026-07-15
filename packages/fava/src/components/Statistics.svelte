<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import { urlFor } from "../helpers";
  import QueryTable from "./QueryTable.svelte";
  import ContentScrollArea from "./ContentScrollArea.svelte";
  let innerHeight = 500;
  const queries: Array<{
    name: string;
    query: string;
  }> = [
    {
      name: "Postings per Account",
      query: `
            SELECT account, count(account)
            FROM postings
            GROUP BY account
            `,
    },
    {
      name: "Update Activity",
      query: `
            SELECT
                account,
                max(date) AS last_entry,
                sum(number) AS balance
            FROM postings
            GROUP BY account
            ORDER BY last_entry DESC
            `,
    },
    {
      name: "Entries Per Type",
      query: `
            SELECT type, count(type)
            FROM entries
            GROUP BY type
            `,
    },
  ];
</script>

<svelte:window bind:innerHeight />
<ContentScrollArea contentClass="scroll-container">
  <div class="flex">
    <div class="flex w-full flex-row flex-wrap justify-center">
      {#each queries as query}
        <div class={` p-2`}>
          <div class="flex items-center justify-between">
            <h3 class="mr-1">{query.name}</h3>
            <Button
              variant="outline"
              size="sm"
              href={urlFor("/query", { qs: query.query })}>Query</Button
            >
          </div>
          <QueryTable query={query.query} height={(innerHeight - 250) / 2} />
        </div>
      {/each}
    </div>
  </div>
</ContentScrollArea>
