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

<thead
  bind:this={ref}
  class={cn("cn-table-table-header-14-1", className)}
  {...restProps}
  data-ui-component="table"
  data-ui-part="table-header"
>
  {@render children?.()}
</thead>
