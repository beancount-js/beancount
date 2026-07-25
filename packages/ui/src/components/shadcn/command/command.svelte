<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    value = $bindable(""),
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CommandPrimitive.RootProps = $props();
</script>

<CommandPrimitive.Root
  class={cn("cn-command-command-15-1", className)}
  bind:ref
  bind:value
  {...restProps}
  data-ui-component="command"
  data-ui-part="command"
/>
