<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLLiAttributes } from "svelte/elements";

  let {
    ref = $bindable(null),
    children,
    ...restProps
  }: WithElementRef<HTMLLiAttributes> = $props();
</script>

<li
  bind:this={ref}
  data-slot="pagination-item"
  {...restProps}
  data-ui-component="pagination"
  data-ui-part="pagination-item"
>
  {@render children?.()}
</li>
