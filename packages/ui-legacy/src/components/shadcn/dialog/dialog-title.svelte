<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DialogPrimitive.TitleProps = $props();
</script>

<DialogPrimitive.Title
  bind:ref
  class={cn("cn-dialog-dialog-title-14-1", className)}
  {...restProps}
  data-ui-component="dialog"
  data-ui-part="dialog-title"
/>
