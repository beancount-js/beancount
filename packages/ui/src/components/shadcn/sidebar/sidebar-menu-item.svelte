<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLLIElement>, HTMLLIElement> = $props();
</script>

<li
  bind:this={ref}
  data-sidebar="menu-item"
  class={cn("cn-sidebar-sidebar-menu-item-17-1 cn-group-menu-item", className)}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-menu-item"
>
  {@render children?.()}
</li>
