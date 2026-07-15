<script lang="ts">
  import { SegmentedControl, type FormFieldRenderArgs } from "@beancount-js/forms";
  import { Input } from "$lib/components/ui/input";
  import {
    secretDisplayValue,
    secretMode,
    secretStoredValue,
    type SecretMode,
  } from "../../ingestion/secret-ref";

  let {
    value,
    field,
    readonly = false,
    update,
  }: FormFieldRenderArgs<unknown, unknown, string> = $props();

  const mode = $derived(secretMode(typeof value === "string" ? value : ""));
  const display = $derived(
    secretDisplayValue(typeof value === "string" ? value : ""),
  );

  function setMode(next: string) {
    const nextMode = next as SecretMode;
    if (nextMode === mode) return;
    void update(secretStoredValue(nextMode, ""));
  }

  function setDisplay(next: string) {
    void update(secretStoredValue(mode, next));
  }
</script>

{#if readonly}
  <output>
    {mode === "env"
      ? (typeof value === "string" ? value : " ")
      : typeof value === "string" && value
        ? "••••••••"
        : " "}
  </output>
{:else}
  <div class="secret-field" data-secret-field={field.id}>
    <SegmentedControl
      value={mode}
      options={["env", "inline"]}
      labels={{ env: "Environment", inline: "Inline" }}
      ariaLabel={`${field.ariaLabel ?? field.label} source`}
      onChange={setMode}
    />
    <Input
      type={mode === "inline" ? "password" : "text"}
      autocomplete="off"
      spellcheck={false}
      value={display}
      placeholder={mode === "env" ? "BANK_API_TOKEN" : "Paste API key"}
      aria-label={field.ariaLabel ?? field.label}
      oninput={(event) => setDisplay(event.currentTarget.value)}
    />
  </div>
{/if}

<style>
  .secret-field {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    box-sizing: border-box;
    padding-block: 0.5rem;
  }

  .secret-field :global(input) {
    width: 100%;
  }
</style>
