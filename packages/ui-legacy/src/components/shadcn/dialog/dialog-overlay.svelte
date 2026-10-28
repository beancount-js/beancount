<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay
  bind:ref
  class={cn("cn-dialog-dialog-overlay-15-1", className)}
  {...restProps}
  data-ui-component="dialog"
  data-ui-part="dialog-overlay"
/>
