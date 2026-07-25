<script lang="ts">
  import * as ResizablePrimitive from "paneforge";
  import { cn } from "../../../lib/utils.js";

  type $$Props = ResizablePrimitive.PaneGroupProps;

  let className: $$Props["class"] = undefined;
  export let direction: $$Props["direction"];
  export { className as class };
</script>

<ResizablePrimitive.PaneGroup
  {direction}
  class={cn("cn-resizable-resizable-pane-group-14-1", className)}
  {...$$restProps}
  data-ui-component="resizable"
  data-ui-part="resizable-pane-group"
>
  <slot />
</ResizablePrimitive.PaneGroup>
