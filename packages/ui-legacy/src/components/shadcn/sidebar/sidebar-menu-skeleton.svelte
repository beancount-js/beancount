<script lang="ts">
  import { Skeleton } from "../skeleton/index.js";
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    showIcon = false,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> & {
    showIcon?: boolean;
  } = $props();

  // Random width between 50% and 90%
  const width = `${Math.floor(Math.random() * 40) + 50}%`;
</script>

<div
  bind:this={ref}
  data-sidebar="menu-skeleton"
  class={cn("cn-sidebar-sidebar-menu-skeleton-24-1", className)}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-menu-skeleton"
>
  {#if showIcon}
    <Skeleton
      class="cn-sidebar-sidebar-menu-skeleton-28-1"
      data-sidebar="menu-skeleton-icon"
    />
  {/if}
  <Skeleton
    class="cn-sidebar-sidebar-menu-skeleton-31-1"
    data-sidebar="menu-skeleton-text"
    style="--skeleton-width: {width};"
  />
  {@render children?.()}
</div>
