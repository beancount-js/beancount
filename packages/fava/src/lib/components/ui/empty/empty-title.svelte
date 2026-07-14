<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils.js";

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
  class={cn("text-lg font-semibold tracking-tight", className)}
  {...restProps}
>
  {@render children?.()}
</h2>
