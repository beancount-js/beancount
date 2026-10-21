<script lang="ts">
  import { untrack } from "svelte";
  import AccountNavigationLink from "../../components/navigation/AccountNavigationLink.svelte";
  import { useContext } from "../context";
  import { urlForAccount } from "../helpers";
  import {
    accountAppearanceStore,
    merchantLogosForController,
  } from "../lib/account-appearance";
  import { useBeancountController } from "../../controller/context";
  let {
    account,
    label,
    avatarSize = "sm",
    onclick,
    onkeydown,
    class: className,
  }: {
    account: string;
    label?: string;
    avatarSize?: "sm" | "md" | "lg";
    onclick?: (event: MouseEvent) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    class?: string;
  } = $props();
  const controller = useBeancountController();
  const { ledgerData } = useContext();
  const appearances = accountAppearanceStore(ledgerData);
  const appearance = $derived($appearances.get(account));
  let merchantLogoUrl = $state("");
  $effect(() => {
    const projectId = controller.state.snapshot?.project.id;
    const merchantId = appearance?.merchantId;
    merchantLogoUrl = "";
    let current = true;
    if (projectId && merchantId)
      untrack(() => {
        void merchantLogosForController(controller, projectId).then((logos) => {
          if (current) merchantLogoUrl = logos.get(merchantId) ?? "";
        });
      });
    return () => {
      current = false;
    };
  });
</script>

<AccountNavigationLink
  {account}
  {label}
  href={urlForAccount(account)}
  {avatarSize}
  appearance={appearance ? { ...appearance, merchantLogoUrl } : undefined}
  {onclick}
  {onkeydown}
  class={className}
/>
