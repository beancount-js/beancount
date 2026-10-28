<script lang="ts">
  import { Select as SelectPrimitive, type WithoutChild } from "bits-ui";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: WithoutChild<SelectPrimitive.TriggerProps> = $props();
</script>

<SelectPrimitive.Trigger
  bind:ref
  class={cn("cn-select-select-trigger-17-1", className)}
  {...restProps}
  data-ui-component="select"
  data-ui-part="select-trigger"
>
  {@render children?.()}
  <ChevronDown class="cn-select-select-trigger-23-1" />
</SelectPrimitive.Trigger>
