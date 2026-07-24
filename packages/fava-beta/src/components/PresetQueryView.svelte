<script context="module" lang="ts">
  export type PresetQuery = {
    id: string;
    name: string;
    query: string;
  };
</script>

<script lang="ts">
  import Button from "$lib/components/ui/button/button.svelte";
  import * as ScrollArea from "$lib/components/ui/scroll-area";
  import * as Tabs from "$lib/components/ui/tabs";
  import { urlFor } from "../helpers";
  import ContentScrollArea from "@beancount-js/ui/layout/ContentScrollArea.svelte";
  import QueryTable from "./QueryTable.svelte";

  /**
   * Application-level BQL presets. Query execution and result rendering remain
   * owned by Fava's QueryTable adapter.
   */
  export let queries: readonly PresetQuery[] = [];
  /** Keep long tab labels reachable without changing the page's vertical scroll. */
  export let scrollTabs = false;
  /** Align the per-preset Query link with the Statistics toolbar when needed. */
  export let alignQueryActionEnd = false;

  let value = "";

  $: if (!queries.some((query) => query.id === value)) {
    value = queries[0]?.id ?? "";
  }

  function handleChange(id: string | undefined) {
    value = id || queries[0]?.id || "";
  }
</script>

<ContentScrollArea contentClass="scroll-container min-h-full p-4">
  <Tabs.Root class="w-full" {value} onValueChange={handleChange}>
    {#if scrollTabs}
      <ScrollArea.Root orientation="horizontal" class="w-full">
        <div class="w-max pr-3">
          <Tabs.List>
            {#each queries as query}
              <Tabs.Trigger value={query.id}>{query.name}</Tabs.Trigger>
            {/each}
          </Tabs.List>
        </div>
      </ScrollArea.Root>
    {:else}
      <Tabs.List>
        {#each queries as query}
          <Tabs.Trigger value={query.id}>{query.name}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    {/if}

    {#each queries as query}
      <Tabs.Content value={query.id}>
        <div class:justify-end={alignQueryActionEnd} class="flex">
          <Button
            variant="outline"
            size="sm"
            href={urlFor("/query", { qs: query.query.trim() })}>Query</Button
          >
        </div>
        {#if value === query.id}
          <QueryTable query={query.query} />
        {/if}
      </Tabs.Content>
    {/each}
  </Tabs.Root>
</ContentScrollArea>
