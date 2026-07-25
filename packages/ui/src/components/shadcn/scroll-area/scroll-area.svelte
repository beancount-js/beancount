<script lang="ts">
  import {
    ScrollArea as ScrollAreaPrimitive,
    type WithoutChild,
  } from "bits-ui";
  import { Scrollbar } from "./index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    orientation = "vertical",
    scrollbarXClasses = "",
    scrollbarYClasses = "",
    children,
    ...restProps
  }: WithoutChild<ScrollAreaPrimitive.RootProps> & {
    orientation?: "vertical" | "horizontal" | "both" | undefined;
    scrollbarXClasses?: string | undefined;
    scrollbarYClasses?: string | undefined;
  } = $props();
</script>

<ScrollAreaPrimitive.Root
  bind:ref
  {...restProps}
  class={cn("cn-scroll-area-scroll-area-27-1", className)}
>
  <ScrollAreaPrimitive.Viewport
    class="cn-scroll-area-scroll-area-30-1"
    tabindex={0}
    data-ui-component="scroll-area"
    data-ui-part="scroll-area"
  >
    {@render children?.()}
  </ScrollAreaPrimitive.Viewport>
  {#if orientation === "vertical" || orientation === "both"}
    <Scrollbar orientation="vertical" class={scrollbarYClasses} />
  {/if}
  {#if orientation === "horizontal" || orientation === "both"}
    <Scrollbar orientation="horizontal" class={scrollbarXClasses} />
  {/if}
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
