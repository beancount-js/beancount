<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children,
    heading,
    ...restProps
  }: CommandPrimitive.GroupProps & {
    heading?: string;
  } = $props();
</script>

<CommandPrimitive.Group
  class={cn("cn-command-command-group-17-1", className)}
  bind:ref
  {...restProps}
  data-ui-component="command"
  data-ui-part="command-group"
>
  {#if heading}
    <CommandPrimitive.GroupHeading class="cn-command-command-group-23-1">
      {heading}
    </CommandPrimitive.GroupHeading>
  {/if}
  <CommandPrimitive.GroupItems {children} />
</CommandPrimitive.Group>
