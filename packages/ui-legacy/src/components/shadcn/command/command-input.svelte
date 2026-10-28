<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import Search from "lucide-svelte/icons/search";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    value = $bindable(""),
    ...restProps
  }: CommandPrimitive.InputProps = $props();
</script>

<div
  class="cn-command-command-input-14-1"
  data-command-input-wrapper=""
  data-ui-component="command"
  data-ui-part="command-input"
>
  <Search class="cn-command-command-input-15-1" />
  <CommandPrimitive.Input
    class={cn("cn-command-command-input-18-1", className)}
    bind:ref
    bind:value
    {...restProps}
  />
</div>
