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

<caption
  bind:this={ref}
  class={cn("cn-table-table-caption-16-1", className)}
  {...restProps}
  data-ui-component="table"
  data-ui-part="table-caption"
>
  {@render children?.()}
</caption>
