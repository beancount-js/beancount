<script lang="ts" generics="TRoot, TContext = undefined">
  import type { Snippet } from "svelte";
  import CodeEditor from "./CodeEditor.svelte";
  import StructuredForm from "./StructuredForm.svelte";
  import type {
    FormValidationIssue,
    FormViewName,
    YamlBackedFormConfig,
  } from "../types";

  let {
    value,
    config,
    context = undefined,
    view = "edit",
    issues = [],
    readonly = false,
    yamlMode = false,
    yamlText = $bindable(""),
    yamlError = "",
    yamlLabel = "YAML source editor",
    yamlMinHeight = "26rem",
    yamlResetLabel = "Reset",
    yamlApplyLabel = "Apply YAML",
    onChange = () => {},
    onYamlChange = () => {},
    onYamlApply = () => {},
    onYamlReset = () => {},
    children,
  }: {
    value?: TRoot;
    config?: YamlBackedFormConfig<TRoot, TContext>;
    context?: TContext;
    view?: FormViewName;
    issues?: FormValidationIssue[];
    readonly?: boolean;
    yamlMode?: boolean;
    yamlText?: string;
    yamlError?: string;
    yamlLabel?: string;
    yamlMinHeight?: string;
    yamlResetLabel?: string;
    yamlApplyLabel?: string;
    onChange?: (value: TRoot) => void | Promise<void>;
    onYamlChange?: (value: string) => void | Promise<void>;
    onYamlApply?: () => void | Promise<void>;
    onYamlReset?: () => void | Promise<void>;
    children?: Snippet;
  } = $props();

  function handleYamlChange(next: string) {
    void onYamlChange(next);
  }
</script>

{#if yamlMode}
  <div class="beancount-yaml-backed-form">
    <CodeEditor
      bind:value={yamlText}
      language="yaml"
      minHeight={yamlMinHeight}
      ariaLabel={yamlLabel}
      onChange={handleYamlChange}
    />
    {#if yamlError}
      <p class="beancount-yaml-backed-form__error" role="alert">
        {yamlError}
      </p>
    {/if}
    <div class="beancount-yaml-backed-form__actions">
      <button type="button" onclick={() => void onYamlReset()}>
        {yamlResetLabel}
      </button>
      <button type="button" class="primary" onclick={() => void onYamlApply()}>
        {yamlApplyLabel}
      </button>
    </div>
  </div>
{:else if children}
  {@render children()}
{:else if config && value !== undefined}
  <StructuredForm
    {value}
    {config}
    context={context as TContext}
    {view}
    {issues}
    {readonly}
    {onChange}
  />
{/if}

<style>
  .beancount-yaml-backed-form {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }

  .beancount-yaml-backed-form__error {
    margin: 0;
    color: var(--destructive);
    font-size: 0.8125rem;
  }

  .beancount-yaml-backed-form__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .beancount-yaml-backed-form__actions button {
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

  .beancount-yaml-backed-form__actions button.primary {
    border-color: var(--primary);
    color: var(--primary-foreground);
    background: var(--primary);
  }
</style>
