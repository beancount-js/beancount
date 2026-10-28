<script lang="ts">
  import type { Separator as SeparatorPrimitive } from "bits-ui";
  import { Separator } from "../separator/index.js";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: SeparatorPrimitive.RootProps = $props();
</script>

<Separator
  bind:ref
  class={cn("cn-select-select-separator-15-1", className)}
  {...restProps}
  data-ui-component="select"
  data-ui-part="select-separator"
/>
