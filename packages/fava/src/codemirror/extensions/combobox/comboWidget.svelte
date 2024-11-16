<script lang="ts">
  import { Edit } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
    import ComboBox from "../../../components/ComboBox.svelte";
  export let className: string | undefined = undefined;
  export let accounts:
    | Array<{ label: string; value: string }>
    | (() => Array<{ label: string; value: string }>);
  export let value: string | undefined = undefined;
  export let onValueChange: (value: string) => void;
  $: count = Array.isArray(accounts) ? accounts.length : accounts().length;
</script>

{#if count > 1}
  <ComboBox
    class={cn("cm-inactive-hide inline-block font-mono", className)}
    {value}
    items={accounts}
    {onValueChange}
  >
    <Button
      slot="trigger"
      let:builder
      builders={[builder]}
      variant="outline"
      role="combobox"
      class={cn(
        "clickable-icon view-action inline-block size-[20px] p-[3px] pt-0",
      )}
    >
      <Edit class="size-4" />
    </Button>
  </ComboBox>
{/if}
