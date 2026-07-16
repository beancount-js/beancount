<script lang="ts">
  import { Progress as ProgressPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    max = 100,
    value = 0,
    ...restProps
  }: ProgressPrimitive.RootProps = $props();
</script>

<ProgressPrimitive.Root
  bind:ref
  {value}
  {max}
  data-slot="progress"
  class={cn(
    "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
    className,
  )}
  {...restProps}
>
  <div
    data-slot="progress-indicator"
    class="bg-primary h-full w-full flex-1 transition-all"
    style={`transform: translateX(-${100 - (100 * (value ?? 0)) / (max ?? 100)}%)`}
  ></div>
</ProgressPrimitive.Root>
