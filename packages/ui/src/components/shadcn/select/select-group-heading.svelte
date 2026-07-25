<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SelectPrimitive.GroupHeadingProps = $props();
</script>

<SelectPrimitive.GroupHeading
  bind:ref
  class={cn("cn-select-select-group-heading-14-1", className)}
  {...restProps}
  data-ui-component="select"
  data-ui-part="select-group-heading"
/>
