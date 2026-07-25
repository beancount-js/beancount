<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    inset = false,
    children,
    ...restProps
  }: DropdownMenuPrimitive.ItemProps & {
    inset?: boolean;
    children?: Snippet;
  } = $props();
</script>

<DropdownMenuPrimitive.Item
  bind:ref
  class={cn(
    "cn-dropdown-menu-dropdown-menu-item-21-1",
    inset && "cn-dropdown-menu-dropdown-menu-item-22-1",
    className,
  )}
  {...restProps}
  data-ui-component="dropdown-menu"
  data-ui-part="dropdown-menu-item"
>
  {@render children?.()}
</DropdownMenuPrimitive.Item>
