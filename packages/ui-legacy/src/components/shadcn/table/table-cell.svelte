<script lang="ts">
  import type { HTMLTdAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLTdAttributes> = $props();
</script>

<td
  bind:this={ref}
  class={cn("cn-table-table-cell-17-1", className)}
  {...restProps}
  data-ui-component="table"
  data-ui-part="table-cell"
>
  {@render children?.()}
</td>
