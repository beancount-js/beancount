<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.GridBodyProps = $props();
</script>

<CalendarPrimitive.GridBody
  bind:ref
  class={cn(className)}
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar-grid-body"
/>
