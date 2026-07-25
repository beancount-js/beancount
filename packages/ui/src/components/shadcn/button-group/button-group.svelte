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
  role="group"
  data-slot="button-group"
  class={cn("cn-button-group-button-group-19-1", className)}
  {...restProps}
  data-ui-component="button-group"
  data-ui-part="button-group"
>
  {@render children?.()}
</div>
