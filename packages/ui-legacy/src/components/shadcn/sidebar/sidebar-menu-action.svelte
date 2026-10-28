<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    showOnHover = false,
    children,
    child,
    ...restProps
  }: WithElementRef<HTMLButtonAttributes> & {
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    showOnHover?: boolean;
  } = $props();

  const mergedProps = $derived({
    class: cn(
      "cn-sidebar-shadcn-sidebar-sidebar-menu-action-21-1",
      // Increases the hit area of the button on mobile.
      "cn-sidebar-shadcn-sidebar-sidebar-menu-action-23-1",
      "cn-sidebar-shadcn-sidebar-sidebar-menu-action-24-1",
      "cn-sidebar-shadcn-sidebar-sidebar-menu-action-25-1",
      "cn-sidebar-shadcn-sidebar-sidebar-menu-action-26-1",
      "cn-sidebar-shadcn-sidebar-sidebar-menu-action-27-1",
      showOnHover && "cn-sidebar-shadcn-sidebar-sidebar-menu-action-29-1",
      className,
    ),
    "data-sidebar": "menu-action",
    ...restProps,
  });
</script>

{#if child}
  {@render child({ props: mergedProps })}
{:else}
  <button
    bind:this={ref}
    {...mergedProps}
    data-ui-component="sidebar"
    data-ui-part="sidebar-menu-action"
  >
    {@render children?.()}
  </button>
{/if}
