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
  data-slot="empty"
  class={cn("cn-empty-empty-18-1", className)}
  {...restProps}
  data-ui-component="empty"
  data-ui-part="empty"
>
  {@render children?.()}
</div>
