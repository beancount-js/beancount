<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.HeadCellProps = $props();
</script>

<CalendarPrimitive.HeadCell
  bind:ref
  class={cn("cn-calendar-calendar-head-cell-15-1", className)}
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar-head-cell"
/>
