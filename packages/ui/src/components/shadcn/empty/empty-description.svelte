<script lang="ts">
  import type { WithElementRef } from "bits-ui";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithElementRef<HTMLAttributes<HTMLParagraphElement>> = $props();
</script>

<p
  bind:this={ref}
  data-slot="empty-description"
  class={cn("cn-empty-empty-description-17-1", className)}
  {...restProps}
  data-ui-component="empty"
  data-ui-part="empty-description"
>
  {@render children?.()}
</p>
