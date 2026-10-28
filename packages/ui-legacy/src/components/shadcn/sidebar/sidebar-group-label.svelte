<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    children,
    child,
    class: className,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> & {
    child?: Snippet<[{ props: Record<string, unknown> }]>;
  } = $props();

  const mergedProps = $derived({
    class: cn(
      "cn-sidebar-shadcn-sidebar-sidebar-group-label-19-1",
      "cn-sidebar-shadcn-sidebar-sidebar-group-label-20-1",
      className,
    ),
    "data-sidebar": "group-label",
    ...restProps,
  });
</script>

{#if child}
  {@render child({ props: mergedProps })}
{:else}
  <div
    bind:this={ref}
    {...mergedProps}
    data-ui-component="sidebar"
    data-ui-part="sidebar-group-label"
  >
    {@render children?.()}
  </div>
{/if}
