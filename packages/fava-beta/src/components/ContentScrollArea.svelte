<script lang="ts">
  import type { Snippet } from "svelte";
  import * as ScrollArea from "$lib/components/ui/scroll-area";
  import { cn } from "$lib/utils";

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
  class={cn("h-full min-h-0 min-w-0", className)}
>
  <div class={cn("min-w-0", contentClass)}>
    {@render children?.()}
  </div>
</ScrollArea.Root>
