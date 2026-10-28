<script lang="ts">
  import type { Snippet } from "svelte";
  import ContentScrollArea from "../layout/ContentScrollArea.svelte";
  import Button from "../shadcn/button/button.svelte";
  import * as ScrollArea from "../shadcn/scroll-area";
  import * as Tabs from "../shadcn/tabs";

  export type PresetQuery = {
    id: string;
    name: string;
    query: string;
  };

  let {
    queries,
    value = $bindable(""),
    scrollTabs = false,
    alignQueryActionEnd = false,
    queryHref,
    onValueChange = () => {},
    children,
  }: {
    queries: readonly PresetQuery[];
    value?: string;
    /** Keep long tab labels reachable without changing vertical page scroll. */
    scrollTabs?: boolean;
    /** Align the per-preset Query action with a page toolbar. */
    alignQueryActionEnd?: boolean;
    /** Application-owned destination for editing a preset query. */
    queryHref: (query: PresetQuery) => string;
    onValueChange?: (id: string) => void;
    /** Application-owned query result for the active preset. */
    children?: Snippet<[PresetQuery]>;
  } = $props();

  $effect(() => {
    if (!queries.some((query) => query.id === value)) {
      value = queries[0]?.id ?? "";
    }
  });

  function changeValue(id: string | undefined) {
    const next = id || queries[0]?.id || "";
    if (next === value) return;
    value = next;
    onValueChange(next);
  }
</script>

<ContentScrollArea
  contentClass="scroll-container cn-pages-scroll-content--full cn-pages-scroll-content--padded"
>
  <Tabs.Root
    class="cn-pages-presetqueryview-51-1"
    {value}
    onValueChange={changeValue}
  >
    {#if scrollTabs}
      <ScrollArea.Root
        orientation="horizontal"
        class="cn-pages-presetqueryview-53-1"
      >
        <div class="cn-pages-presetqueryview-54-1">
          <Tabs.List>
            {#each queries as query (query.id)}
              <Tabs.Trigger value={query.id}>{query.name}</Tabs.Trigger>
            {/each}
          </Tabs.List>
        </div>
      </ScrollArea.Root>
    {:else}
      <Tabs.List>
        {#each queries as query (query.id)}
          <Tabs.Trigger value={query.id}>{query.name}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    {/if}

    {#each queries as query (query.id)}
      <Tabs.Content value={query.id}>
        <div
          class:cn-pages-presetqueryview-72-2={alignQueryActionEnd}
          class="cn-pages-presetqueryview-72-1"
        >
          <Button variant="outline" size="sm" href={queryHref(query)}>
            Query
          </Button>
        </div>
        {#if value === query.id}
          {@render children?.(query)}
        {/if}
      </Tabs.Content>
    {/each}
  </Tabs.Root>
</ContentScrollArea>
