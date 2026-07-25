<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLHeadingElement>> = $props();
</script>

<h2
  bind:this={ref}
  data-slot="empty-title"
  class={cn("cn-empty-empty-title-17-1", className)}
  {...restProps}
  data-ui-component="empty"
  data-ui-part="empty-title"
>
  {@render children?.()}
</h2>
