<script lang="ts">
  import { Calendar as CalendarPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    child,
    ...restProps
  }: CalendarPrimitive.HeaderProps = $props();
</script>

{#snippet CalendarHeader({ props }: { props: Record<string, unknown> })}
  {#if child}
    {@render child({ props })}
  {:else}
    <div {...props}>
      {@render children?.()}
    </div>
  {/if}
{/snippet}

<CalendarPrimitive.Header
  bind:ref
  class={cn(
    "relative flex w-full items-center justify-between pt-1",
    className,
  )}
  {...restProps}
  child={CalendarHeader}
/>
