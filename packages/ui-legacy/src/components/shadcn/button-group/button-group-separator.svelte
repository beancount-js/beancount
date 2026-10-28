<script lang="ts">
  import type { ComponentProps } from "svelte";
  import { Separator } from "../separator";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    orientation = "vertical",
    ...restProps
  }: ComponentProps<typeof Separator> = $props();
</script>

<Separator
  bind:ref
  data-slot="button-group-separator"
  {orientation}
  class={cn("cn-button-group-button-group-separator-19-1", className)}
  {...restProps}
  data-ui-component="button-group"
  data-ui-part="button-group-separator"
/>
