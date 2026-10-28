<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<div
  bind:this={ref}
  data-sidebar="footer"
  class={cn("cn-sidebar-sidebar-footer-17-1", className)}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-footer"
>
  {@render children?.()}
</div>
