<script lang="ts">
  import { Dialog as SheetPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SheetPrimitive.OverlayProps = $props();
</script>

<SheetPrimitive.Overlay
  bind:ref
  class={cn("cn-sheet-sheet-overlay-15-1", className)}
  {...restProps}
  data-ui-component="sheet"
  data-ui-part="sheet-overlay"
/>
