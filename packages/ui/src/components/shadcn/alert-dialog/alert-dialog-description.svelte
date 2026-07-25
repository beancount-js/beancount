<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    class: className,
    ref = $bindable(null),
    ...restProps
  }: AlertDialogPrimitive.DescriptionProps = $props();
</script>

<AlertDialogPrimitive.Description
  bind:ref
  class={cn("cn-alert-dialog-alert-dialog-description-14-1", className)}
  {...restProps}
  data-ui-component="alert-dialog"
  data-ui-part="alert-dialog-description"
/>
