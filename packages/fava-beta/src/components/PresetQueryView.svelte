<script lang="ts">
  import PresetQueryView, {
    type PresetQuery,
  } from "@beancount-js/ui/pages/PresetQueryView.svelte";
  import { urlFor } from "../helpers";
  import QueryTable from "./QueryTable.svelte";

  export let queries: readonly PresetQuery[] = [];
  export let scrollTabs = false;
  export let alignQueryActionEnd = false;
</script>

<PresetQueryView
  {queries}
  {scrollTabs}
  {alignQueryActionEnd}
  queryHref={(query) => urlFor("/query", { qs: query.query.trim() })}
>
  {#snippet children(query)}
    <QueryTable query={query.query} />
  {/snippet}
</PresetQueryView>
