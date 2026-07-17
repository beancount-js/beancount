<script lang="ts">
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

<style>
  :global(.beancount-scroll-area__scrollbar) {
    display: flex;
    touch-action: none;
    user-select: none;
    transition:
      color 150ms ease,
      background-color 150ms ease;
  }

  :global(.beancount-scroll-area__scrollbar--vertical) {
    width: 0.625rem;
    height: 100%;
    border-left: 1px solid transparent;
    padding: 1px;
  }

  :global(.beancount-scroll-area__scrollbar--horizontal) {
    width: 100%;
    height: 0.625rem;
    border-top: 1px solid transparent;
    padding: 1px;
  }

  :global(.beancount-scroll-area__thumb) {
    position: relative;
    flex: 1;
    border-radius: 999px;
    background: var(--border);
  }
</style>
