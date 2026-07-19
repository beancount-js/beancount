<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import Ellipsis from "lucide-svelte/icons/ellipsis";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
  bind:this={ref}
  aria-hidden="true"
  data-slot="pagination-ellipsis"
  class={cn("flex size-8 items-center justify-center", className)}
  {...restProps}
>
  <Ellipsis />
  <span class="sr-only">More pages</span>
</span>
