<script lang="ts">
  import Edit from "lucide-svelte/icons/edit";
  import ComboBox from "../../../components/ComboBox.svelte";
  import { cn } from "$lib/utils.js";
  let {
    class: klass,
    items,
    value = "",
    onValueChange,
  }: {
    class?: string;
    items:
      | Array<{ label: string; value: string }>
      | (() => Array<{ label: string; value: string }>);
    value: string;
    onValueChange: (value: string) => void;
  } = $props();

  let count = $derived.by(() =>
    Array.isArray(items) ? items.length : items().length,
  );
</script>

{#if count > 1}
  <ComboBox
    class={cn("cm-inactive-hide inline-block font-mono", klass)}
    {value}
    {items}
    {onValueChange}
  >
    {#snippet icon({ props })}
      <Edit class="size-4" />
    {/snippet}
  </ComboBox>
{/if}
