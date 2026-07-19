<script lang="ts">
  import { Input } from "../shadcn/input";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import {
    secretFieldDisplayValue,
    secretFieldMode,
    secretFieldStoredValue,
  } from "./secret-field-value";

  let {
    value = "",
    environmentKeys = [],
    label = "Secret",
    ariaLabel = label,
    environmentPlaceholder = "",
    readOnly = false,
    onChange = () => {},
  }: {
    /** `env:NAME` selects an environment reference; other values are inline. */
    value?: string;
    /** Environment variable names supplied by the application. */
    environmentKeys?: readonly string[];
    label?: string;
    ariaLabel?: string;
    environmentPlaceholder?: string;
    readOnly?: boolean;
    onChange?: (value: string) => void | Promise<void>;
  } = $props();

  const mode = $derived(secretFieldMode(value));
  const display = $derived(secretFieldDisplayValue(value));
  const environmentLabel = $derived(
    environmentPlaceholder.trim() || label || "Environment variable",
  );
  const environmentOptions = $derived(
    environmentKeys.map((key) => ({ value: key, label: key })),
  );

  function setMode(next: string) {
    if (next === mode) return;
    void onChange(secretFieldStoredValue(next as typeof mode, ""));
  }

  function setDisplay(next: string) {
    void onChange(secretFieldStoredValue(mode, next));
  }
</script>

{#if readOnly}
  <output>
    {mode === "env" ? value || " " : value ? "••••••••" : " "}
  </output>
{:else}
  <div class="bj-secret-field">
    <SegmentedControl
      value={mode}
      options={["env", "inline"]}
      labels={{ env: "Environment", inline: "Inline" }}
      ariaLabel={`${ariaLabel} source`}
      onChange={setMode}
    />
    {#if mode === "env"}
      <FilterCommandPicker
        value={display}
        options={environmentOptions}
        allowCustom
        label={environmentLabel}
        placeholder="Search project .env keys..."
        emptyLabel="No matching .env keys. Type a custom name."
        {ariaLabel}
        onChange={setDisplay}
      />
    {:else}
      <Input
        type="password"
        autocomplete="off"
        spellcheck={false}
        value={display}
        placeholder="Paste API key"
        aria-label={ariaLabel}
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
