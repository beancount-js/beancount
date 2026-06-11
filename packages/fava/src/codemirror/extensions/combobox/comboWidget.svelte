<script lang="ts">
  import Edit from "lucide-svelte/icons/edit";
  import ComboBox from "../../../components/ComboBox.svelte";
  import { cn } from "$lib/utils.js";
  import { Button } from "$lib/components/ui/button";
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
    {#snippet trigger({ props, value, open, hasSelection })}
      <Button
        variant="ghost"
        class="inline-block py-0 text-xs"
        {...props}
        role="combobox"
        aria-expanded={open}
        size="xs"
      >
        <Edit class="size-2" />
        <span class="sr-only">{value}</span>
      </Button>
    {/snippet}
  </ComboBox>
{/if}
