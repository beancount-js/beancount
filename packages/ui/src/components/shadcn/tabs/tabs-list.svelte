<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  type $$Props = TabsPrimitive.ListProps;

  let className: $$Props["class"] = undefined;
  export { className as class };
</script>

<TabsPrimitive.List
  class={cn("cn-tabs-tabs-list-13-1", className)}
  {...$$restProps}
  data-ui-component="tabs"
  data-ui-part="tabs-list"
>
  <slot />
</TabsPrimitive.List>
