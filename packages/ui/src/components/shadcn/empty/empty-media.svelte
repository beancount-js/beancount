<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    variant = "default",
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
    variant?: "default" | "icon";
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="empty-media"
  data-variant={variant}
  class={cn(variant === "icon" && "cn-empty-empty-media-23-1", className)}
  {...restProps}
  data-ui-component="empty"
  data-ui-part="empty-media"
>
  {@render children?.()}
</div>
