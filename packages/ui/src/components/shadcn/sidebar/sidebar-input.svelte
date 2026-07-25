<script lang="ts">
  import { Input } from "../input/index.js";
  import { cn } from "../../../lib/utils.js";
  import type { ComponentProps } from "svelte";

  let {
    ref = $bindable(null),
    value = $bindable(""),
    class: className,
    ...restProps
  }: ComponentProps<typeof Input> = $props();
</script>

<Input
  bind:ref
  bind:value
  data-sidebar="input"
  class={cn("cn-sidebar-sidebar-input-19-1", className)}
  {...restProps}
  data-ui-component="sidebar"
  data-ui-part="sidebar-input"
/>
