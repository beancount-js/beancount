<script lang="ts">
  import {
    AlertDialog as AlertDialogPrimitive,
    type WithoutChild,
  } from "bits-ui";
  import AlertDialogOverlay from "./alert-dialog-overlay.svelte";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    portalProps,
    ...restProps
  }: WithoutChild<AlertDialogPrimitive.ContentProps> & {
    portalProps?: AlertDialogPrimitive.PortalProps;
  } = $props();
</script>

<AlertDialogPrimitive.Portal {...portalProps}>
  <AlertDialogOverlay />
  <AlertDialogPrimitive.Content
    bind:ref
    class={cn("cn-alert-dialog-alert-dialog-content-24-1", className)}
    {...restProps}
    data-ui-component="alert-dialog"
    data-ui-part="alert-dialog-content"
  />
</AlertDialogPrimitive.Portal>
