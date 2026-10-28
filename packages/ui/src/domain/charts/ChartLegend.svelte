<script lang="ts">
  import type { Writable } from "svelte/store";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";

  /** The chart legend to show. */
  export let legend: [string, string | null][];
  /** A list of elements that are toggled. */
  export let toggled: Writable<string[]> | null = null;
  /** Alternatively, a single active element, all others are toggled. */
  export let active: Writable<string | null> | null = null;

  $: selected = toggled
    ? legend.map((it) => it[0]).filter((it) => !$toggled?.includes(it))
    : [];

  $: handleChange = (value: string | Array<string> | undefined) => {
    if (!value) {
      return;
    }
    if (active && typeof value === "string") {
      active.set(value);
    } else if (toggled && Array.isArray(value)) {
      const updated = legend
        .map((it) => it[0])
        .filter((it) => !value.includes(it));
      toggled.update((v) => updated);
    }
  };
</script>

{#if active}
  <ToggleGroup.Root
    variant="outline"
    data-beancount-toggle="tinted"
    value={$active || ""}
    type="single"
    onValueChange={handleChange}
  >
    {#each legend as [item, color]}
      <ToggleGroup.Item value={item} aria-label={`Toggle ${item}`}>
        {#if color}
          <span
            style="background-color: {color}"
            class="mr-1 size-3 rounded-full"
          ></span>
        {/if}
        <span class:line-through={$active !== item}>{item}</span>
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
{:else if toggled}
  <ToggleGroup.Root
    variant="outline"
    data-beancount-toggle="tinted"
    value={selected}
    type="multiple"
    onValueChange={handleChange}
  >
    {#each legend as [item, color]}
      <ToggleGroup.Item value={item} aria-label={`Toggle ${item}`}>
        {#if color}
          <span
            style="background-color: {color}"
            class="mr-1 size-3 rounded-full"
          ></span>
        {/if}
        <span class:line-through={$toggled?.includes(item)}>{item}</span>
      </ToggleGroup.Item>
    {/each}
  </ToggleGroup.Root>
{/if}
