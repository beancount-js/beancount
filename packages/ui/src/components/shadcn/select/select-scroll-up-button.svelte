<script lang="ts">
  import ChevronUp from "lucide-svelte/icons/chevron-up";
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

<SelectPrimitive.ScrollUpButton
  bind:ref
  class={cn("cn-select-select-scroll-up-button-18-1", className)}
  {...restProps}
  data-ui-component="select"
  data-ui-part="select-scroll-up-button"
>
  <ChevronUp class="cn-select-select-scroll-up-button-21-1" />
</SelectPrimitive.ScrollUpButton>
