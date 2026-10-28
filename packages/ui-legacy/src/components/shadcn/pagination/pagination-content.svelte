<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLUListElement>> = $props();
</script>

<ul
  bind:this={ref}
  data-slot="pagination-content"
  class={cn("cn-pagination-pagination-content-17-1", className)}
  {...restProps}
  data-ui-component="pagination"
  data-ui-part="pagination-content"
>
  {@render children?.()}
</ul>
