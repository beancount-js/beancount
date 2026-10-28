<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import { slide } from "svelte/transition";
  import { cn } from "../../../lib/utils.js";

  type $$Props = AccordionPrimitive.ContentProps;

  let className: $$Props["class"] = undefined;
  export let transition = slide;
  export let transitionConfig = {
    duration: 200,
  };

  export { className as class };
</script>

<AccordionPrimitive.Content
  class={cn("cn-accordion-accordion-content-18-1", className)}
  {...$$restProps}
  data-ui-component="accordion"
  data-ui-part="accordion-content"
>
  <div
    class="cn-accordion-accordion-content-21-1"
    transition:transition={transitionConfig}
  >
    <slot />
  </div>
</AccordionPrimitive.Content>
