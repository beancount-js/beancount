<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils.js";

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
  class={cn(
    variant === "icon" &&
      "flex size-12 items-center justify-center rounded-lg bg-muted [&_svg]:size-6",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
