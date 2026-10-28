<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
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
  class={cn("cn-sheet-sheet-header-16-1", className)}
  {...restProps}
  data-ui-component="sheet"
  data-ui-part="sheet-header"
>
  {@render children?.()}
</div>
