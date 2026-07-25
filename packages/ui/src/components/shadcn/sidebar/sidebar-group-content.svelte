<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
  bind:this={ref}
  data-sidebar="group-content"
  class={cn("cn-sidebar-sidebar-group-content-17-1", className)}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-group-content"
>
  {@render children?.()}
</div>
