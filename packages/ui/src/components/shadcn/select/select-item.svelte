<script lang="ts">
  import { Select as SelectPrimitive, type WithoutChild } from "bits-ui";
  import Check from "lucide-svelte/icons/check";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    value,
    label,
    children: childrenProp,
    ...restProps
  }: WithoutChild<SelectPrimitive.ItemProps> = $props();
</script>

<SelectPrimitive.Item
  bind:ref
  {value}
  class={cn("cn-select-select-item-20-1", className)}
  {...restProps}
  data-ui-component="select"
  data-ui-part="select-item"
>
  {#snippet children({ selected, highlighted })}
    <span class="cn-select-select-item-26-1">
      {#if selected}
        <Check class="cn-select-select-item-28-1" />
      {/if}
    </span>
    {#if childrenProp}
      {@render childrenProp({ selected, highlighted })}
    {:else}
      {label || value}
    {/if}
  {/snippet}
</SelectPrimitive.Item>
