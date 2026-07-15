<script lang="ts">
  import type { FormFieldRenderArgs } from "@beancount-js/forms";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import { cn } from "$lib/utils.js";
  import ComboBox from "../ComboBox.svelte";

  type AccountContext = {
    accounts?: string[];
  };

  let {
    value,
    field,
    context,
    readonly = false,
    update,
  }: FormFieldRenderArgs<unknown, AccountContext, string> = $props();

  const items = $derived(
    (context?.accounts ?? []).map((account: string) => ({
      label: account,
      value: account,
    })),
  );
</script>

{#if readonly}
  <output>{value || " "}</output>
{:else}
  <div data-account-field={field.id} class="account-combo-field">
    <ComboBox
      {items}
      value={value ?? ""}
      placeholder={field.placeholder ?? "Select account"}
      onValueChange={(next) => void update(next)}
    >
      {#snippet trigger({ props, value: display, hasSelection, placeholder })}
        <button
          type="button"
          class="account-combo-trigger"
          {...props}
          role="combobox"
        >
          <span class={cn(!hasSelection && "account-combo-placeholder")}
            >{display || placeholder}</span
          >
          <ChevronsUpDown class="size-3.5 shrink-0 opacity-50" />
        </button>
      {/snippet}
    </ComboBox>
  </div>
{/if}

<style>
  .account-combo-field {
    width: 100%;
    min-width: 0;
  }

  .account-combo-field :global([data-slot="popover-trigger"]),
  .account-combo-field :global(button.account-combo-trigger) {
    display: inline-flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border: 0;
    background: transparent;
    color: var(
      --cv-form-foreground,
      var(--beancount-form-foreground, var(--foreground))
    );
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
    line-height: 1.45;
    padding: 0.35rem 0;
    text-align: left;
  }

  .account-combo-placeholder {
    color: var(
      --cv-form-muted,
      var(--beancount-form-muted, var(--muted-foreground))
    );
  }

  .account-combo-trigger:focus,
  .account-combo-trigger:focus-visible {
    outline: 0;
    box-shadow: none;
  }
</style>
