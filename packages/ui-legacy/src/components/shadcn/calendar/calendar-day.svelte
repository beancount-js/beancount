<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import { buttonVariants } from "../button/index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.DayProps = $props();
</script>

<CalendarPrimitive.Day
  class={cn(
    buttonVariants({ variant: "ghost" }),
    "cn-calendar-shadcn-calendar-calendar-day-16-1",
    // Today
    "cn-calendar-shadcn-calendar-calendar-day-18-1",
    // Selected
    "cn-calendar-shadcn-calendar-calendar-day-20-1",
    // Disabled
    "cn-calendar-shadcn-calendar-calendar-day-22-1",
    // Unavailable
    "cn-calendar-shadcn-calendar-calendar-day-24-1",
    // Outside months
    "cn-calendar-shadcn-calendar-calendar-day-26-1",
    className,
  )}
  bind:ref
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar-day"
/>
