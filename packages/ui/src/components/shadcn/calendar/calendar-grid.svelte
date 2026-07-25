<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.GridProps = $props();
</script>

<CalendarPrimitive.Grid
  bind:ref
  class={cn("cn-calendar-calendar-grid-14-1", className)}
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar-grid"
/>
