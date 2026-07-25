<script lang="ts">
  import {
    Command as CommandPrimitive,
    Dialog as DialogPrimitive,
    type WithoutChildrenOrChild,
  } from "bits-ui";
  import type { Snippet } from "svelte";
  import Command from "./command.svelte";
  import * as Dialog from "../dialog/index.js";

  let {
    open = $bindable(false),
    ref = $bindable(null),
    value = $bindable(""),
    portalProps,
    children,
    ...restProps
  }: WithoutChildrenOrChild<DialogPrimitive.RootProps> &
    WithoutChildrenOrChild<CommandPrimitive.RootProps> & {
      portalProps?: DialogPrimitive.PortalProps;
      children: Snippet;
    } = $props();
</script>

<Dialog.Root bind:open {...restProps}>
  <Dialog.Content
    class="cn-command-command-dialog-26-1"
    {portalProps}
    data-ui-component="command"
    data-ui-part="command-dialog"
  >
    <Command
      class="cn-command-command-dialog-28-1"
      {...restProps}
      bind:value
      bind:ref
      {children}
    />
  </Dialog.Content>
</Dialog.Root>
