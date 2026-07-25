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

<main
  bind:this={ref}
  class={cn(
    "cn-sidebar-sidebar-inset-17-1",
    "cn-sidebar-sidebar-inset-18-1",
    className,
  )}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-inset"
>
  {@render children?.()}
</main>
