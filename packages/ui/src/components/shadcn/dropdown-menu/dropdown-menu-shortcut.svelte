<script lang="ts">
  import { cn } from "../../../lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Snippet } from "svelte";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: HTMLAttributes<HTMLSpanElement> & {
    ref?: HTMLSpanElement | null;
    children?: Snippet;
  } = $props();
</script>

<span
  bind:this={ref}
  class={cn("ml-auto text-xs tracking-widest opacity-60", className)}
  {...restProps}
>
  {@render children?.()}
</span>
