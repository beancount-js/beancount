<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLSpanElement> & {
    ref?: HTMLSpanElement | null;
    children?: Snippet;
  } = $props();
</script>

<span
  bind:this={ref}
  class={cn("cn-dropdown-menu-dropdown-menu-shortcut-19-1", className)}
  {...restProps}
  data-ui-component="dropdown-menu"
  data-ui-part="dropdown-menu-shortcut"
>
  {@render children?.()}
</span>
