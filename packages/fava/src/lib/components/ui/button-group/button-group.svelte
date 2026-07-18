<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils.js";

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
  class={cn(
    "flex w-fit items-stretch [&>button:first-child]:rounded-r-none [&>button:last-child]:rounded-l-none [&>button]:relative [&>button]:focus-visible:z-10",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
