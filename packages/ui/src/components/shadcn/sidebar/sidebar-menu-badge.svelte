<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<div
  bind:this={ref}
  data-sidebar="menu-badge"
  class={cn(
    "cn-sidebar-sidebar-menu-badge-18-1",
    "cn-sidebar-sidebar-menu-badge-19-1",
    "cn-sidebar-sidebar-menu-badge-20-1",
    "cn-sidebar-sidebar-menu-badge-21-1",
    "cn-sidebar-sidebar-menu-badge-22-1",
    "cn-sidebar-sidebar-menu-badge-23-1",
    className,
  )}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-menu-badge"
>
  {@render children?.()}
</div>
