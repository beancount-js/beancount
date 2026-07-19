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
  data-slot="empty"
  class={cn(
    "flex h-full w-full flex-1 flex-col items-center justify-center gap-6 p-6 text-center",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</div>
