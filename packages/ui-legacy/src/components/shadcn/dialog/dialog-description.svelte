<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description
  bind:ref
  class={cn("cn-dialog-dialog-description-14-1", className)}
  {...restProps}
  data-ui-component="dialog"
  data-ui-part="dialog-description"
/>
