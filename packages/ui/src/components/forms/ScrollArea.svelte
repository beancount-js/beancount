<script lang="ts">
  import {
    ScrollArea as ScrollAreaPrimitive,
    type WithoutChild,
  } from "bits-ui";
  import ScrollAreaScrollbar from "./ScrollAreaScrollbar.svelte";

  let {
    ref = $bindable(null),
    class: className = "",
    orientation = "vertical",
    tabindex = 0,
    children,
    ...restProps
  }: WithoutChild<ScrollAreaPrimitive.RootProps> & {
    orientation?: "vertical" | "horizontal" | "both";
  } = $props();
</script>

<ScrollAreaPrimitive.Root
  bind:ref
  {...restProps}
  class={`beancount-scroll-area ${className}`}
>
  <ScrollAreaPrimitive.Viewport
    class="beancount-scroll-area__viewport"
    {tabindex}
  >
    {@render children?.()}
  </ScrollAreaPrimitive.Viewport>
  {#if orientation === "vertical" || orientation === "both"}
    <ScrollAreaScrollbar orientation="vertical" />
  {/if}
  {#if orientation === "horizontal" || orientation === "both"}
    <ScrollAreaScrollbar orientation="horizontal" />
  {/if}
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>

<style>
  :global(.beancount-scroll-area) {
    position: relative;
    overflow: hidden;
  }

  :global(.beancount-scroll-area__viewport) {
    width: 100%;
    height: 100%;
    border-radius: inherit;
  }
</style>
