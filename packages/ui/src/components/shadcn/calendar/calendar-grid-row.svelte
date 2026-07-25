<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.GridRowProps = $props();
</script>

<CalendarPrimitive.GridRow
  bind:ref
  class={cn("cn-calendar-calendar-grid-row-14-1", className)}
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar-grid-row"
/>
