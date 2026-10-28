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
  class={cn("cn-dialog-dialog-footer-17-1", className)}
  {...restProps}
  data-ui-component="dialog"
  data-ui-part="dialog-footer"
>
  {@render children?.()}
</div>
