<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.CellProps = $props();
</script>

<CalendarPrimitive.Cell
  class={cn("cn-calendar-calendar-cell-14-1", className)}
  bind:ref
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar-cell"
/>
