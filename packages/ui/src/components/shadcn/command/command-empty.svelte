<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CommandPrimitive.EmptyProps = $props();
</script>

<CommandPrimitive.Empty
  bind:ref
  class={cn("cn-command-command-empty-14-1", className)}
  {...restProps}
  data-ui-component="command"
  data-ui-part="command-empty"
/>
