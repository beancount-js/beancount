<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    child,
    ...restProps
  }: WithElementRef<HTMLButtonAttributes> & {
    child?: Snippet<[{ props: Record<string, unknown> }]>;
  } = $props();

  const propObj = $derived({
    class: cn(
      "cn-sidebar-shadcn-sidebar-sidebar-group-action-19-1",
      // Increases the hit area of the button on mobile.
      "cn-sidebar-shadcn-sidebar-sidebar-group-action-21-1",
      "cn-sidebar-shadcn-sidebar-sidebar-group-action-22-1",
      className,
    ),
    "data-sidebar": "group-action",
    ...restProps,
  });
</script>

{#if child}
  {@render child({ props: propObj })}
{:else}
  <button
    bind:this={ref}
    {...propObj}
    data-ui-component="sidebar"
    data-ui-part="sidebar-group-action"
  >
    {@render children?.()}
  </button>
{/if}
