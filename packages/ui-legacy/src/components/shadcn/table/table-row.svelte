<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLTableRowElement>> = $props();
</script>

<tr
  bind:this={ref}
  class={cn("cn-table-table-row-17-1", className)}
  {...restProps}
  data-ui-component="table"
  data-ui-part="table-row"
>
  {@render children?.()}
</tr>
