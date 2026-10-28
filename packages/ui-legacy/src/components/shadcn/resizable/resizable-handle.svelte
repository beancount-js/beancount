<script lang="ts">
  import DragHandleDots2 from "svelte-radix/DragHandleDots2.svelte";
  import * as ResizablePrimitive from "paneforge";
  import { cn } from "../../../lib/utils.js";

  type $$Props = ResizablePrimitive.PaneResizerProps & {
    withHandle?: boolean;
  };

  export let withHandle: $$Props["withHandle"] = false;
  let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<ResizablePrimitive.PaneResizer
  class={cn("cn-resizable-resizable-handle-17-1", className)}
  data-ui-component="resizable"
  data-ui-part="resizable-handle"
>
  {#if withHandle}
    <div class="cn-resizable-resizable-handle-23-1">
      <DragHandleDots2 class="cn-resizable-resizable-handle-25-1" />
    </div>
  {/if}
</ResizablePrimitive.PaneResizer>
