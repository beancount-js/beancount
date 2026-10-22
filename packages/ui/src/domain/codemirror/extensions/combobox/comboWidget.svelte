<script lang="ts">
  import FilterCommandPicker from "../../../../components/forms/FilterCommandPicker.svelte";
  import AccountAvatar from "../../../../components/forms/AccountAvatar.svelte";
  import { readable } from "svelte/store";
  import { untrack } from "svelte";
  import { useContext } from "../../../context";
  import { useBeancountController } from "../../../../controller/context";
  import {
    accountAppearanceStore,
    merchantLogosForController,
    type AccountAppearance,
  } from "../../../lib/account-appearance";

  let {
    class: klass,
    items,
    value = "",
    nodeName,
    onValueChange,
  }: {
    class?: string;
    items:
      | Array<{ label: string; value: string }>
      | (() => Array<{ label: string; value: string }>);
    value: string;
    nodeName: string;
    onValueChange: (value: string) => void;
  } = $props();
  const options = $derived(Array.isArray(items) ? items : items());
  const isAccount = $derived(nodeName === "AccountName");
  const app = useContext();
  const controller = useBeancountController();
  const appearances = app
    ? accountAppearanceStore(app.ledgerData)
    : readable(new Map<string, AccountAppearance>());
  const appearance = $derived(isAccount ? $appearances.get(value) : undefined);
  let merchantLogoUrl = $state("");
  $effect(() => {
    const projectId = controller?.state.snapshot?.project.id;
    const merchantId = appearance?.merchantId;
    merchantLogoUrl = "";
    let current = true;
    if (controller && projectId && merchantId)
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

<span
  class={klass}
  class:cm-inline-account={isAccount}
  data-inline-account={isAccount ? value : undefined}
>
  {#if isAccount}
    <span class="cm-inline-account__avatar">
      <AccountAvatar
        account={value}
        color={appearance?.color}
        icon={appearance?.icon}
        {merchantLogoUrl}
        size="sm"
      />
    </span>
  {/if}
  <FilterCommandPicker
    label="Account"
    ariaLabel="Account"
    {options}
    {value}
    allowCustom
    onChange={onValueChange}
  />
</span>

<style>
  /* Keep the source columns and line height stable while exposing a measurable target. */
  :global(.cm-account-combo-host[data-node-name="AccountName"]) {
    display: inline-flex;
    width: 1rem;
    margin-left: 0.1rem;
    margin-right: -1.1rem;
    vertical-align: middle;
  }
  .cm-inline-account {
    position: relative;
    display: inline-flex;
    width: 1rem;
    height: 1rem;
  }
  .cm-inline-account__avatar {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .cm-inline-account :global(.beancount-account-avatar[data-size="sm"]) {
    width: 1rem;
    height: 1rem;
    font-size: 0.625rem;
    vertical-align: top;
  }
  .cm-inline-account
    :global(
      .beancount-account-avatar[data-size="sm"] .beancount-account-avatar__icon
    ) {
    width: 0.75rem;
    height: 0.75rem;
  }
  .cm-inline-account :global(.ui-filter-command-picker__trigger) {
    width: 1rem;
    height: 1rem;
    min-height: 0;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .cm-inline-account :global(.ui-filter-command-picker__trigger:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .cm-inline-account :global(.ui-filter-command-picker__label),
  .cm-inline-account :global(.ui-filter-command-picker__trigger > svg) {
    display: none;
  }
</style>
