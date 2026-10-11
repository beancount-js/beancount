<script lang="ts">
  import { buttonVariants } from "@lapismd/design-core/shadcn/button";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
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
      id: "postings-per-account",
      name: "Postings per Account",
      query: `
            SELECT account, count(account)
            FROM postings
            GROUP BY account
            `,
    },
    {
      id: "update-activity",
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
      id: "entries-per-type",
      name: "Entries Per Type",
      query: `
            SELECT type, count(type)
            FROM entries
            GROUP BY type
      `,
    },
  ];
  let value: string = queries[0].id;

  function handleChange(id: string | undefined) {
    value = id || queries[0].id;
  }
</script>

<svelte:window bind:innerHeight />
<ContentScrollArea contentClass="scroll-container min-h-full p-4">
  <Tabs.Root class="w-full" {value} onValueChange={handleChange}>
    <Tabs.List>
      {#each queries as query}
        <Tabs.Trigger value={query.id}>{query.name}</Tabs.Trigger>
      {/each}
    </Tabs.List>
    {#each queries as query}
      <Tabs.Content value={query.id}>
        <div class="flex justify-end">
          <a
            class={buttonVariants({ variant: "outline", size: "sm" })}
            href={urlFor("/query", { qs: query.query.trim() })}>Query</a
          >
        </div>
        {#if value === query.id}
          <QueryTable
            query={query.query}
            height={Math.max(innerHeight - 190, 280)}
          />
        {/if}
      </Tabs.Content>
    {/each}
  </Tabs.Root>
</ContentScrollArea>
