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

<AccordionPrimitive.Header {level} class="flex">
  <AccordionPrimitive.Trigger
    class={cn(
      "flex flex-1 items-center justify-between py-4 text-sm font-medium transition-all hover:underline",
      indicatorPosition === "start"
        ? "[&>svg]:order-first [&>svg]:-rotate-90 [&[data-state=open]>svg]:rotate-0"
        : "[&[data-state=open]>svg]:rotate-180",
      className,
    )}
    {...$$restProps}
  >
    <slot />
    <ChevronDown
      class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
    />
  </AccordionPrimitive.Trigger>
</AccordionPrimitive.Header>
