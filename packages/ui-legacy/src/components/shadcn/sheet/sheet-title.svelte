<script lang="ts">
  import { Dialog as SheetPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SheetPrimitive.TitleProps = $props();
</script>

<SheetPrimitive.Title
  bind:ref
  class={cn("cn-sheet-sheet-title-14-1", className)}
  {...restProps}
  data-ui-component="sheet"
  data-ui-part="sheet-title"
/>
