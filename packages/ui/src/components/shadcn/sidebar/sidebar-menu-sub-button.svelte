<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    children,
    child,
    class: className,
    size = "md",
    isActive,
    ...restProps
  }: WithElementRef<HTMLAnchorAttributes> & {
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    size?: "sm" | "md";
    isActive?: boolean;
  } = $props();

  const mergedProps = $derived({
    class: cn(
      "cn-sidebar-shadcn-sidebar-sidebar-menu-sub-button-23-1",
      "cn-sidebar-shadcn-sidebar-sidebar-menu-sub-button-24-1",
      size === "sm" && "cn-sidebar-shadcn-sidebar-sidebar-menu-sub-button-25-1",
      size === "md" && "cn-sidebar-shadcn-sidebar-sidebar-menu-sub-button-26-1",
      "cn-sidebar-shadcn-sidebar-sidebar-menu-sub-button-27-1",
      className,
    ),
    "data-sidebar": "menu-sub-button",
    "data-size": size,
    "data-active": isActive,
    ...restProps,
  });
</script>

{#if child}
  {@render child({ props: mergedProps })}
{:else}
  <a
    bind:this={ref}
    {...mergedProps}
    data-ui-component="sidebar"
    data-ui-part="sidebar-menu-sub-button"
  >
    {@render children?.()}
  </a>
{/if}
