<script lang="ts">
  import { Select as SelectPrimitive, type WithoutChild } from "bits-ui";
  import * as Select from "./index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    portalProps,
    children,
    ...restProps
  }: WithoutChild<SelectPrimitive.ContentProps> & {
    portalProps?: SelectPrimitive.PortalProps;
  } = $props();
</script>

<SelectPrimitive.Portal {...portalProps}>
  <SelectPrimitive.Content
    bind:ref
    {sideOffset}
    class={cn("cn-select-select-content-23-1", className)}
    {...restProps}
    data-ui-component="select"
    data-ui-part="select-content"
  >
    <Select.ScrollUpButton />
    <SelectPrimitive.Viewport class={cn("cn-select-select-content-31-1")}>
      {@render children?.()}
    </SelectPrimitive.Viewport>
    <Select.ScrollDownButton />
  </SelectPrimitive.Content>
</SelectPrimitive.Portal>
