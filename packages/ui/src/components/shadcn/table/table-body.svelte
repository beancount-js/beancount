<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLTableSectionElement>> = $props();
</script>

<tbody
  bind:this={ref}
  class={cn("cn-table-table-body-16-1", className)}
  {...restProps}
  data-ui-component="table"
  data-ui-part="table-body"
>
  {@render children?.()}
</tbody>
