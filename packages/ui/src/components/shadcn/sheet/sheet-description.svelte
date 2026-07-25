<script lang="ts">
  import { Dialog as SheetPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SheetPrimitive.DescriptionProps = $props();
</script>

<SheetPrimitive.Description
  bind:ref
  class={cn("cn-sheet-sheet-description-14-1", className)}
  {...restProps}
  data-ui-component="sheet"
  data-ui-part="sheet-description"
/>
