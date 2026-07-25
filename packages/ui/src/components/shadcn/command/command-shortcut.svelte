<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
  class={cn("cn-command-command-shortcut-15-1", className)}
  {...restProps}
  bind:this={ref}
  data-ui-component="command"
  data-ui-part="command-shortcut"
>
  {@render children?.()}
</span>
