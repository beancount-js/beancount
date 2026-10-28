<script lang="ts">
  import type { Snippet } from "svelte";
  import * as ScrollArea from "../shadcn/scroll-area";
  import { cn } from "../../lib/utils";

  /** Additional classes for the scrolling viewport. */
  let {
    class: className = "",
    contentClass = "",
    children,
  }: {
    class?: string;
    contentClass?: string;
    children?: Snippet;
  } = $props();
</script>

<ScrollArea.Root
  data-content-scroll-area
  class={cn("cn-layout-contentscrollarea-20-1", className)}
>
  <div class={cn("cn-layout-contentscrollarea-22-1", contentClass)}>
    {@render children?.()}
  </div>
</ScrollArea.Root>
