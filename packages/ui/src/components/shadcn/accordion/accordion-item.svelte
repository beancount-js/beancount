<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  type $$Props = Omit<AccordionPrimitive.ItemProps, "value"> & {
    value: string;
  };

  let className: $$Props["class"] = undefined;
  export { className as class };
  export let value: string;
</script>

<AccordionPrimitive.Item
  {value}
  class={cn("border-b", className)}
  {...$$restProps}
>
  <slot />
</AccordionPrimitive.Item>
