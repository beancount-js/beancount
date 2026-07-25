<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
  bind:this={ref}
  class={cn("cn-calendar-calendar-months-17-1", className)}
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar-months"
>
  {@render children?.()}
</div>
