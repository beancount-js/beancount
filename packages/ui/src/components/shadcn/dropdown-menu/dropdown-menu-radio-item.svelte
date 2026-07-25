<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import Circle from "lucide-svelte/icons/circle";
  import { cn } from "../../../lib/utils.js";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    children: childrenProp,
    ...restProps
  }: Omit<DropdownMenuPrimitive.RadioItemProps, "children"> & {
    children?: Snippet;
  } = $props();
</script>

<DropdownMenuPrimitive.RadioItem
  bind:ref
  class={cn("cn-dropdown-menu-dropdown-menu-radio-item-20-1", className)}
  {...restProps}
  data-ui-component="dropdown-menu"
  data-ui-part="dropdown-menu-radio-item"
>
  {#snippet children({ checked })}
    <span class="cn-dropdown-menu-dropdown-menu-radio-item-26-1">
      {#if checked}
        <Circle class="cn-dropdown-menu-dropdown-menu-radio-item-28-1" />
      {/if}
    </span>
    {@render childrenProp?.()}
  {/snippet}
</DropdownMenuPrimitive.RadioItem>
