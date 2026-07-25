<script lang="ts">
  import {
    ScrollArea as ScrollAreaPrimitive,
    type WithoutChild,
  } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    orientation = "vertical",
    children,
    ...restProps
  }: WithoutChild<ScrollAreaPrimitive.ScrollbarProps> = $props();
</script>

<ScrollAreaPrimitive.Scrollbar
  bind:ref
  {orientation}
  class={cn(
    "cn-scroll-area-scroll-area-scrollbar-21-1",
    orientation === "vertical" && "cn-scroll-area-scroll-area-scrollbar-23-1",
    orientation === "horizontal" && "cn-scroll-area-scroll-area-scrollbar-25-1",
    className,
  )}
  {...restProps}
  data-ui-component="scroll-area"
  data-ui-part="scroll-area-scrollbar"
>
  {@render children?.()}
  <ScrollAreaPrimitive.Thumb
    class={cn(
      "cn-scroll-area-scroll-area-scrollbar-33-1",
      orientation === "vertical" && "cn-scroll-area-scroll-area-scrollbar-34-1",
    )}
  />
</ScrollAreaPrimitive.Scrollbar>
