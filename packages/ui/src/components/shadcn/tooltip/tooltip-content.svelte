<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    ...restProps
  }: TooltipPrimitive.ContentProps = $props();
</script>

<TooltipPrimitive.Content
  bind:ref
  {sideOffset}
  class={cn("cn-tooltip-tooltip-content-17-1", className)}
  {...restProps}
  data-ui-component="tooltip"
  data-ui-part="tooltip-content"
/>
