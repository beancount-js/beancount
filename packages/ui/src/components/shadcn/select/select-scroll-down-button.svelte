<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import {
    Select as SelectPrimitive,
    type WithoutChildrenOrChild,
  } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithoutChildrenOrChild<SelectPrimitive.ScrollDownButtonProps> = $props();
</script>

<SelectPrimitive.ScrollDownButton
  bind:ref
  class={cn("cn-select-select-scroll-down-button-18-1", className)}
  {...restProps}
  data-ui-component="select"
  data-ui-part="select-scroll-down-button"
>
  <ChevronDown class="cn-select-select-scroll-down-button-21-1" />
</SelectPrimitive.ScrollDownButton>
