<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { useSidebar } from "./context.svelte.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<
    HTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > = $props();

  const sidebar = useSidebar();
</script>

<button
  bind:this={ref}
  data-sidebar="rail"
  aria-label="Toggle Sidebar"
  tabIndex={-1}
  onclick={() => sidebar.toggle()}
  title="Toggle Sidebar"
  class={cn(
    "cn-sidebar-sidebar-rail-28-1",
    "cn-sidebar-sidebar-rail-29-1",
    "cn-sidebar-sidebar-rail-30-1",
    "cn-sidebar-sidebar-rail-31-1",
    "cn-sidebar-sidebar-rail-32-1",
    "cn-sidebar-sidebar-rail-33-1",
    className,
  )}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-rail"
>
  {@render children?.()}
</button>
