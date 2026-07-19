<script lang="ts">
  import type { HTMLTableAttributes } from "svelte/elements";
  import type { WithElementRef } from "bits-ui";
  import { cn } from "../../../lib/utils.js";
  import * as ScrollArea from "../scroll-area/index.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLTableAttributes> = $props();
</script>

<ScrollArea.Root
  orientation="horizontal"
  class="relative w-full min-w-0 max-w-full"
>
  <table
    bind:this={ref}
    class={cn("w-full caption-bottom text-sm", className)}
    {...restProps}
  >
    {@render children?.()}
  </table>
</ScrollArea.Root>
