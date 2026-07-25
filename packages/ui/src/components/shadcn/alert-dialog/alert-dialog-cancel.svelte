<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { buttonVariants } from "../button/index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    class: className,
    ref = $bindable(null),
    ...restProps
  }: AlertDialogPrimitive.CancelProps = $props();
</script>

<AlertDialogPrimitive.Cancel
  bind:ref
  class={cn(
    buttonVariants({ variant: "outline" }),
    "cn-alert-dialog-shadcn-alert-dialog-alert-dialog-cancel-15-1",
    className,
  )}
  {...restProps}
  data-ui-component="alert-dialog"
  data-ui-part="alert-dialog-cancel"
/>
