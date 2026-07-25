<script lang="ts">
  import type { HTMLThAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLThAttributes> = $props();
</script>

<th
  bind:this={ref}
  class={cn("cn-table-table-head-17-1", className)}
  {...restProps}
  data-ui-component="table"
  data-ui-part="table-head"
>
  {@render children?.()}
</th>
