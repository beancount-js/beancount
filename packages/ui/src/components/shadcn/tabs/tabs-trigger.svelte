<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  type $$Props = TabsPrimitive.TriggerProps;

  let className: $$Props["class"] = undefined;
  export let value: $$Props["value"];
  export { className as class };
</script>

<TabsPrimitive.Trigger
  class={cn("cn-tabs-tabs-trigger-14-1", className)}
  {value}
  {...$$restProps}
  data-ui-component="tabs"
  data-ui-part="tabs-trigger"
>
  <slot />
</TabsPrimitive.Trigger>
