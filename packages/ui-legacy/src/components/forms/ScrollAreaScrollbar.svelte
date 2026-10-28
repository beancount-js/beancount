<script lang="ts">
  import "./ScrollAreaScrollbar.css";
  import {
    ScrollArea as ScrollAreaPrimitive,
    type WithoutChild,
  } from "bits-ui";

  let {
    ref = $bindable(null),
    class: className = "",
    orientation = "vertical",
    children,
    ...restProps
  }: WithoutChild<ScrollAreaPrimitive.ScrollbarProps> = $props();
</script>

<ScrollAreaPrimitive.Scrollbar
  bind:ref
  {orientation}
  class={`beancount-scroll-area__scrollbar beancount-scroll-area__scrollbar--${orientation} ${className}`}
  {...restProps}
>
  {@render children?.()}
  <ScrollAreaPrimitive.Thumb class="beancount-scroll-area__thumb" />
</ScrollAreaPrimitive.Scrollbar>
