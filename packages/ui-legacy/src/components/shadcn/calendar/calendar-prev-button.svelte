<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import { buttonVariants } from "../button/index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarPrimitive.PrevButtonProps = $props();
</script>

{#snippet Fallback()}
  <ChevronLeft
    data-ui-component="calendar"
    data-ui-part="calendar-prev-button"
  />
{/snippet}

<CalendarPrimitive.PrevButton
  bind:ref
  class={cn(
    buttonVariants({ variant: "outline" }),
    "cn-calendar-shadcn-calendar-calendar-prev-button-26-1",
    className,
  )}
  {...restProps}
  children={children || Fallback}
/>
