<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    inset = false,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    ref?: HTMLDivElement | null;
    inset?: boolean;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  class={cn(
    "cn-dropdown-menu-dropdown-menu-label-21-1",
    inset && "cn-dropdown-menu-dropdown-menu-label-21-2",
    className,
  )}
  {...restProps}
  data-ui-component="dropdown-menu"
  data-ui-part="dropdown-menu-label"
>
  {@render children?.()}
</div>
