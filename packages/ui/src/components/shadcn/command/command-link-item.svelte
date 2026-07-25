<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: CommandPrimitive.LinkItemProps = $props();
</script>

<CommandPrimitive.LinkItem
  class={cn("cn-command-command-link-item-14-1", className)}
  bind:ref
  {...restProps}
  data-ui-component="command"
  data-ui-part="command-link-item"
/>
