<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CommandPrimitive.ListProps = $props();
</script>

<CommandPrimitive.List
  class={cn("cn-command-command-list-13-1", className)}
  bind:ref
  {...restProps}
  data-ui-component="command"
  data-ui-part="command-list"
/>
