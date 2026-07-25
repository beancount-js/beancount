<script lang="ts">
  import { Progress as ProgressPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

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
  class={cn("cn-progress-progress-20-1", className)}
  {...restProps}
  data-ui-component="progress"
  data-ui-part="progress"
>
  <div
    data-slot="progress-indicator"
    class="cn-progress-progress-27-1"
    style={`transform: translateX(-${100 - (100 * (value ?? 0)) / (max ?? 100)}%)`}
  ></div>
</ProgressPrimitive.Root>
