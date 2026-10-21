<script lang="ts">
  import type { Snippet } from "svelte";
  import * as ScrollArea from "@lapismd/design-core/shadcn/scroll-area";
  let {
    class: className = "",
    contentClass = "",
    children,
  }: { class?: string; contentClass?: string; children?: Snippet } = $props();
</script>

<ScrollArea.Root
  fillContent
  data-content-scroll-area
  class={["h-full min-h-0 min-w-0", className].filter(Boolean).join(" ")}
>
  <div class={["min-w-0", contentClass].filter(Boolean).join(" ")}>
    {@render children?.()}
  </div>
</ScrollArea.Root>
