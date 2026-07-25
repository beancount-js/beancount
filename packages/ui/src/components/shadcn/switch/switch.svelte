<script lang="ts">
  import { Switch as SwitchPrimitive } from "bits-ui";
  import { cn } from "../../../lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    checked = $bindable(false),
    size = "default",
    ...restProps
  }: SwitchPrimitive.RootProps & {
    size?: "sm" | "default";
  } = $props();
</script>

<SwitchPrimitive.Root
  bind:ref
  bind:checked
  data-slot="switch"
  data-size={size}
  class={cn(
    "cn-switch-switch-22-1 cn-peer",
    "cn-switch-switch-23-1",
    "cn-switch-switch-24-1",
    "cn-switch-switch-25-1",
    "cn-switch-switch-26-1",
    "cn-switch-switch-27-1",
    "cn-switch-switch-28-1",
    "cn-switch-switch-29-1",
    "cn-switch-switch-30-1 cn-group-switch",
    className,
  )}
  {...restProps}
>
  <SwitchPrimitive.Thumb
    data-slot="switch-thumb"
    class={cn(
      "cn-switch-switch-38-1",
      "cn-switch-switch-39-1",
      "cn-switch-switch-40-1",
      "cn-switch-switch-41-1",
      "cn-switch-switch-42-1",
    )}
    data-ui-component="switch"
    data-ui-part="switch"
  />
</SwitchPrimitive.Root>
