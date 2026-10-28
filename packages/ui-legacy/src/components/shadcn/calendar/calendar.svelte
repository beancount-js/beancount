<script lang="ts">
  import {
    Calendar as CalendarPrimitive,
    type WithoutChildrenOrChild,
  } from "bits-ui";
  import * as Calendar from "./index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    value = $bindable(),
    placeholder = $bindable(),
    class: className,
    weekdayFormat = "short",
    ...restProps
  }: WithoutChildrenOrChild<CalendarPrimitive.RootProps> = $props();
</script>

<!--
Discriminated Unions + Destructing (required for bindable) do not
get along, so we shut typescript up by casting `value` to `never`.
-->
<CalendarPrimitive.Root
  bind:value={value as never}
  bind:ref
  bind:placeholder
  {weekdayFormat}
  class={cn("cn-calendar-calendar-28-1", className)}
  {...restProps}
  data-ui-component="calendar"
  data-ui-part="calendar"
>
  {#snippet children({ months, weekdays })}
    <Calendar.Header>
      <Calendar.PrevButton />
      <Calendar.Heading />
      <Calendar.NextButton />
    </Calendar.Header>
    <Calendar.Months>
      {#each months as month}
        <Calendar.Grid>
          <Calendar.GridHead>
            <Calendar.GridRow class="cn-calendar-calendar-41-1">
              {#each weekdays as weekday}
                <Calendar.HeadCell>
                  {weekday.slice(0, 2)}
                </Calendar.HeadCell>
              {/each}
            </Calendar.GridRow>
          </Calendar.GridHead>
          <Calendar.GridBody>
            {#each month.weeks as weekDates}
              <Calendar.GridRow class="cn-calendar-calendar-51-1">
                {#each weekDates as date}
                  <Calendar.Cell {date} month={month.value}>
                    <Calendar.Day />
                  </Calendar.Cell>
                {/each}
              </Calendar.GridRow>
            {/each}
          </Calendar.GridBody>
        </Calendar.Grid>
      {/each}
    </Calendar.Months>
  {/snippet}
</CalendarPrimitive.Root>
