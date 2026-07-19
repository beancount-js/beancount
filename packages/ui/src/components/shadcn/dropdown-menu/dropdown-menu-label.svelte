<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    inset = false,
    children,
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    ref?: HTMLDivElement | null;
    inset?: boolean;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  class={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
  {...restProps}
>
  {@render children?.()}
</div>
