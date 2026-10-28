<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import { buttonVariants } from "../button/index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    ...restProps
  }: CalendarPrimitive.NextButtonProps = $props();
</script>

{#snippet Fallback()}
  <ChevronRight
    data-ui-component="calendar"
    data-ui-part="calendar-next-button"
  />
{/snippet}

<CalendarPrimitive.NextButton
  bind:ref
  class={cn(
    buttonVariants({ variant: "outline" }),
    "cn-calendar-shadcn-calendar-calendar-next-button-26-1",
    className,
  )}
  {...restProps}
  children={children || Fallback}
/>
