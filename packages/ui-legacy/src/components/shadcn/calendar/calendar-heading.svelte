<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CalendarPrimitive.HeadingProps = $props();
</script>

<CalendarPrimitive.Heading
  bind:ref
  class={cn("cn-calendar-calendar-heading-14-1", className)}
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar-heading"
/>
