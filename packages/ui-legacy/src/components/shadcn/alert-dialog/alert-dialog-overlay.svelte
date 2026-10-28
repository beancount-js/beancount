<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    class: className,
    ref = $bindable(null),
    ...restProps
  }: AlertDialogPrimitive.OverlayProps = $props();
</script>

<AlertDialogPrimitive.Overlay
  bind:ref
  class={cn("cn-alert-dialog-alert-dialog-overlay-15-1", className)}
  {...restProps}
  data-ui-component="alert-dialog"
  data-ui-part="alert-dialog-overlay"
/>
