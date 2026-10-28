<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import ChevronDown from "svelte-radix/ChevronDown.svelte";
  import { cn } from "../../../lib/utils.js";

  type $$Props = AccordionPrimitive.TriggerProps & {
    indicatorPosition?: "end" | "start";
  };

  let className: $$Props["class"] = undefined;
  export let level: AccordionPrimitive.HeaderProps["level"] = 3;
  export let indicatorPosition: "end" | "start" = "end";
  export { className as class };
</script>

<AccordionPrimitive.Header
  {level}
  class="cn-accordion-accordion-trigger-16-1"
  data-ui-component="accordion"
  data-ui-part="accordion-trigger"
>
  <AccordionPrimitive.Trigger
    class={cn(
      "cn-accordion-accordion-trigger-19-1",
      indicatorPosition === "start"
        ? "cn-accordion-accordion-trigger-21-1"
        : "cn-accordion-accordion-trigger-22-1",
      className,
    )}
    {...$$restProps}
  >
    <slot />
    <ChevronDown class="cn-accordion-accordion-trigger-29-1" />
  </AccordionPrimitive.Trigger>
</AccordionPrimitive.Header>
