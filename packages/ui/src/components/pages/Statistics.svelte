<script lang="ts">
  import type { Snippet } from "svelte";
  import PresetQueryView, { type PresetQuery } from "./PresetQueryView.svelte";

  let {
    queries,
    value = $bindable(""),
    alignQueryActionEnd = false,
    queryHref,
    onValueChange = () => {},
    children,
  }: {
    queries: readonly PresetQuery[];
    value?: string;
    /** Align the per-preset Query action with a page toolbar. */
    alignQueryActionEnd?: boolean;
    /** Application-owned destination for editing a preset query. */
    queryHref: (query: PresetQuery) => string;
    onValueChange?: (id: string) => void;
    /** Application-owned query result for the active preset. */
    children?: Snippet<[PresetQuery]>;
  } = $props();
</script>

<PresetQueryView
  {queries}
  bind:value
  {alignQueryActionEnd}
  {queryHref}
  {onValueChange}
>
  {#snippet children(query)}
    {#if children}
      {@render children(query)}
    {/if}
  {/snippet}
</PresetQueryView>
