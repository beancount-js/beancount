<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<
    HTMLAttributes<HTMLUListElement>,
    HTMLUListElement
  > = $props();
</script>

<ul
  bind:this={ref}
  data-sidebar="menu"
  class={cn("cn-sidebar-sidebar-menu-20-1", className)}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-menu"
>
  {@render children?.()}
</ul>
