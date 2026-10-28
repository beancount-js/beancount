<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  type $$Props = TabsPrimitive.ContentProps;

  let className: $$Props["class"] = undefined;
  export let value: $$Props["value"];
  export { className as class };
</script>

<TabsPrimitive.Content
  class={cn("cn-tabs-tabs-content-14-1", className)}
  {value}
  {...$$restProps}
  data-ui-component="tabs"
  data-ui-part="tabs-content"
>
  <slot />
</TabsPrimitive.Content>
