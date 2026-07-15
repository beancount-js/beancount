<script lang="ts">
  import CodeEditor from "./CodeEditor.svelte";
  import StructuredForm from "./StructuredForm.svelte";
  import type { FormConfig, FormValidationIssue, FormViewName } from "../types";
  import type { Snippet } from "svelte";

  type AnyFormConfig = FormConfig<any, any>;

  let {
    value,
    config,
    view = config?.defaultView ?? "edit",
    context = undefined,
    issues = [],
    readonly = false,
    jsonMode = false,
    jsonText = $bindable(""),
    jsonError = "",
    jsonLabel = "JSON source editor",
    jsonMinHeight = "24rem",
    jsonResetLabel = "Reset",
    jsonApplyLabel = "Apply JSON",
    onChange = () => {},
    onJsonChange = () => {},
    onJsonApply = () => {},
    onJsonReset = () => {},
    children,
  }: {
    value?: unknown;
    config?: AnyFormConfig;
    view?: FormViewName;
    context?: unknown;
    issues?: FormValidationIssue[];
    readonly?: boolean;
    jsonMode?: boolean;
    jsonText?: string;
    jsonError?: string;
    jsonLabel?: string;
    jsonMinHeight?: string;
    jsonResetLabel?: string;
    jsonApplyLabel?: string;
    onChange?: (value: unknown) => void | Promise<void>;
    onJsonChange?: (value: string) => void | Promise<void>;
    onJsonApply?: () => void | Promise<void>;
    onJsonReset?: () => void | Promise<void>;
    children?: Snippet;
  } = $props();

  function handleJsonChange(next: string) {
    void onJsonChange(next);
  }
</script>

{#if jsonMode}
  <div class="beancount-json-backed-form">
    <CodeEditor
      bind:value={jsonText}
      language="json"
      minHeight={jsonMinHeight}
      ariaLabel={jsonLabel}
      onChange={handleJsonChange}
    />
    {#if jsonError}
      <p class="beancount-json-backed-form__error" role="alert">{jsonError}</p>
    {/if}
    <div class="beancount-json-backed-form__actions">
      <button type="button" onclick={() => void onJsonReset()}
        >{jsonResetLabel}</button
      >
      <button type="button" class="primary" onclick={() => void onJsonApply()}
        >{jsonApplyLabel}</button
      >
    </div>
  </div>
{:else if children}
  {@render children()}
{:else if config}
  <StructuredForm
    {value}
    {config}
    {view}
    {context}
    {issues}
    {readonly}
    {onChange}
  />
{/if}

<style>
  .beancount-json-backed-form {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }

  .beancount-json-backed-form__error {
    margin: 0;
    color: var(--destructive);
    font-size: 0.8125rem;
  }

  .beancount-json-backed-form__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .beancount-json-backed-form__actions button {
    min-height: 2rem;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) - 2px);
    padding: 0 0.75rem;
    color: var(--foreground);
    background: var(--background);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .beancount-json-backed-form__actions button.primary {
    border-color: var(--primary);
    color: var(--primary-foreground);
    background: var(--primary);
  }
</style>
