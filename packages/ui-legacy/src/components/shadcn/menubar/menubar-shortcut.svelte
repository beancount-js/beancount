<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
  bind:this={ref}
  class={cn("cn-menubar-menubar-shortcut-16-1", className)}
  {...restProps}
  data-ui-component="menubar"
  data-ui-part="menubar-shortcut"
>
  {@render children?.()}
</span>
