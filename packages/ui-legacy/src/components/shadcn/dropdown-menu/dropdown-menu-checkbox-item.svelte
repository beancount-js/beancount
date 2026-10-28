<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import Check from "lucide-svelte/icons/check";
  import { cn } from "../../../lib/utils.js";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    checked = $bindable(false),
    class: className,
    children: childrenProp,
    ...restProps
  }: Omit<DropdownMenuPrimitive.CheckboxItemProps, "children"> & {
    children?: Snippet;
  } = $props();
</script>

<DropdownMenuPrimitive.CheckboxItem
  bind:ref
  bind:checked
  class={cn("cn-dropdown-menu-dropdown-menu-checkbox-item-22-1", className)}
  {...restProps}
  data-ui-component="dropdown-menu"
  data-ui-part="dropdown-menu-checkbox-item"
>
  {#snippet children({ checked })}
    <span class="cn-dropdown-menu-dropdown-menu-checkbox-item-28-1">
      {#if checked}
        <Check class="cn-dropdown-menu-dropdown-menu-checkbox-item-30-1" />
      {/if}
    </span>
    {@render childrenProp?.()}
  {/snippet}
</DropdownMenuPrimitive.CheckboxItem>
