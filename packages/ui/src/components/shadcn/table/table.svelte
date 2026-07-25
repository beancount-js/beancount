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
  class="cn-table-table-17-1"
  data-ui-component="table"
  data-ui-part="table"
>
  <table
    bind:this={ref}
    class={cn("cn-table-table-21-1", className)}
    {...restProps}
  >
    {@render children?.()}
  </table>
</ScrollArea.Root>
