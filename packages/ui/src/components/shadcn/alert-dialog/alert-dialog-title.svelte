<script lang="ts">
  import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    class: className,
    level = 3,
    ref = $bindable(null),
    ...restProps
  }: AlertDialogPrimitive.TitleProps = $props();
</script>

<AlertDialogPrimitive.Title
  bind:ref
  class={cn("cn-alert-dialog-alert-dialog-title-15-1", className)}
  {level}
  {...restProps}
  data-ui-component="alert-dialog"
  data-ui-part="alert-dialog-title"
/>
