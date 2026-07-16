<script lang="ts">
  import {
    FilterCommandPicker,
    SegmentedControl,
    type FormFieldRenderArgs,
  } from "@beancount-js/forms";
  import { Input } from "$lib/components/ui/input";
  import {
    secretDisplayValue,
    secretMode,
    secretStoredValue,
    type SecretMode,
  } from "../../ingestion/secret-ref";
  import type { SourceFormContext } from "../../ingestion/source-form-config";

  let {
    value,
    field,
    context,
    readonly = false,
    update,
    envPlaceholder,
  }: FormFieldRenderArgs<unknown, SourceFormContext, string> & {
    envPlaceholder?: string;
  } = $props();

  const mode = $derived(secretMode(typeof value === "string" ? value : ""));
  const display = $derived(
    secretDisplayValue(typeof value === "string" ? value : ""),
  );
  const envOptions = $derived(
    (context?.envKeys ?? []).map((key) => ({ value: key, label: key })),
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
      ? typeof value === "string"
        ? value
        : " "
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
    {#if mode === "env"}
      <FilterCommandPicker
        value={display}
        options={envOptions}
        allowCustom={true}
        fullWidth={true}
        label={envPlaceholder?.trim() || field.label || "Environment variable"}
        placeholder="Search project .env keys..."
        emptyLabel="No matching .env keys. Type a custom name."
        ariaLabel={field.ariaLabel ?? field.label}
        onChange={setDisplay}
      />
    {:else}
      <Input
        type="password"
        autocomplete="off"
        spellcheck={false}
        value={display}
        placeholder="Paste API key"
        aria-label={field.ariaLabel ?? field.label}
        oninput={(event) => setDisplay(event.currentTarget.value)}
      />
    {/if}
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
