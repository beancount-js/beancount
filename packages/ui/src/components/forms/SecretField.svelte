<script lang="ts">
  import { Input } from "../shadcn/input";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import type { FormFieldRenderArgs } from "./types";
  import {
    secretFieldDisplayValue,
    secretFieldMode,
    secretFieldStoredValue,
  } from "./secret-field-value";

  type SecretFieldContext = {
    envKeys?: string[];
  };
  type SecretFieldStandaloneProps = {
    value?: string;
    /** Environment variable names supplied by the application. */
    environmentKeys?: readonly string[];
    label?: string;
    ariaLabel?: string;
    environmentPlaceholder?: string;
    readOnly?: boolean;
    onChange?: (value: string) => void | Promise<void>;
  };

  let props:
    | (FormFieldRenderArgs<unknown, SecretFieldContext, string> & {
        envPlaceholder?: string;
      })
    | SecretFieldStandaloneProps = $props();

  const hasAppContext = $derived(
    Object.hasOwn(props as object, "field") &&
      Object.hasOwn(props as object, "context") &&
      Object.hasOwn(props as object, "update"),
  );

  const resolvedValue = $derived(
    typeof props.value === "string" ? props.value : "",
  );
  const resolvedLabel = $derived(
    (props as SecretFieldStandaloneProps).label ??
      (hasAppContext
        ? (props as FormFieldRenderArgs<unknown, SecretFieldContext, string>)
            .field?.label
        : undefined) ??
      "Secret",
  );
  const resolvedAriaLabel = $derived(
    (props as SecretFieldStandaloneProps).ariaLabel ??
      (hasAppContext
        ? (props as FormFieldRenderArgs<unknown, SecretFieldContext, string>)
            .field?.ariaLabel
        : undefined) ??
      resolvedLabel,
  );
  const readOnly = $derived(
    (props as { readonly?: boolean }).readonly ??
      (props as SecretFieldStandaloneProps).readOnly ??
      false,
  );
  const environmentKeys = $derived(
    hasAppContext
      ? ((props as FormFieldRenderArgs<unknown, SecretFieldContext, string>)
          .context?.envKeys ?? [])
      : ((props as SecretFieldStandaloneProps).environmentKeys ?? []),
  );
  const environmentPlaceholder = $derived(
    (props as SecretFieldStandaloneProps).environmentPlaceholder ??
      (props as { envPlaceholder?: string }).envPlaceholder ??
      "",
  );

  const mode = $derived(secretFieldMode(resolvedValue));
  const display = $derived(secretFieldDisplayValue(resolvedValue));
  const environmentLabel = $derived(
    environmentPlaceholder.trim() || resolvedLabel || "Environment variable",
  );
  const environmentOptions = $derived(
    environmentKeys.map((key) => ({ value: key, label: key })),
  );

  function emit(nextValue: string) {
    if (
      hasAppContext &&
      typeof (props as FormFieldRenderArgs<unknown, SecretFieldContext, string>)
        .update === "function"
    ) {
      void (
        props as FormFieldRenderArgs<unknown, SecretFieldContext, string>
      ).update(nextValue);
      return;
    }

    void (props as SecretFieldStandaloneProps).onChange?.(nextValue);
  }

  function setMode(next: string) {
    if (next === mode) return;
    emit(secretFieldStoredValue(next as typeof mode, ""));
  }

  function setDisplay(next: string) {
    emit(secretFieldStoredValue(mode, next));
  }
</script>

{#if readOnly}
  <output>
    {mode === "env" ? resolvedValue || " " : resolvedValue ? "••••••••" : " "}
  </output>
{:else}
  <div class="bj-secret-field">
    <SegmentedControl
      value={mode}
      options={["env", "inline"]}
      labels={{ env: "Environment", inline: "Inline" }}
      ariaLabel={`${resolvedAriaLabel} source`}
      onChange={setMode}
    />
    {#if mode === "env"}
      <FilterCommandPicker
        value={display}
        options={environmentOptions}
        allowCustom={true}
        label={environmentLabel}
        placeholder="Search project .env keys..."
        emptyLabel="No matching .env keys. Type a custom name."
        ariaLabel={resolvedAriaLabel}
        onChange={setDisplay}
      />
    {:else}
      <Input
        type="password"
        autocomplete="off"
        spellcheck={false}
        value={display}
        placeholder="Paste API key"
        aria-label={resolvedAriaLabel}
        oninput={(event) => setDisplay(event.currentTarget.value)}
      />
    {/if}
  </div>
{/if}

<style>
  .bj-secret-field {
    display: flex;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding-block: 0.5rem;
  }

  .bj-secret-field :global(input) {
    width: 100%;
  }

  .bj-secret-field :global(.bj-filter-command-picker__trigger) {
    width: auto;
    max-width: 100%;
  }
</style>
