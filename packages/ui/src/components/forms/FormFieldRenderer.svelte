<script lang="ts">
  import ChipAutocomplete from "./ChipAutocomplete.svelte";
  import FormField from "./FormField.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";
  import TagEditor from "./TagEditor.svelte";
  import { autosizeTextarea } from "./autosize-textarea";
  import {
    defaultFieldAlign,
    defaultFieldWrapper,
    fieldIssuesFor,
    formatFieldValue,
    rendererPropsFor,
    resolveFieldRenderer,
  } from "./registry";
  import type {
    FormFieldConfig,
    FormValidationIssue,
    FormViewName,
  } from "./types";

  type AnyField = FormFieldConfig<any, any, any>;
  export let root: unknown;
  export let field: AnyField;
  export let view: FormViewName = "edit";
  export let context: unknown = undefined;
  export let issues: FormValidationIssue[] = [];
  export let readonly = false;
  export let onChange: (value: unknown) => void | Promise<void> = () => {};

  $: value = field.get(root, context);
  $: fieldIssues = fieldIssuesFor(issues, field);
  $: renderer = resolveFieldRenderer(field, view, readonly);
  $: fieldReadonly =
    readonly ||
    field.readonly === true ||
    view === "readonly" ||
    (view !== "edit" && renderer?.interactive !== true);
  $: options = field.options
    ? typeof field.options === "function"
      ? field.options({ root, value, field, context })
      : field.options
    : [];
  $: suggestions = field.suggestions
    ? typeof field.suggestions === "function"
      ? field.suggestions({ root, value, field, context })
      : field.suggestions
    : [];
  $: arrayValue = Array.isArray(value) ? value.map(String) : [];
  $: text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(", ")
        : String(value);
  $: useSegmented =
    field.kind === "segmented" ||
    ((field.kind === "options" || field.kind === "choice") &&
      options.length > 0 &&
      options.length <= 3);
  $: wrapper =
    renderer?.as ??
    (renderer?.wrapper === "none"
      ? undefined
      : (field.as ?? (useSegmented ? "div" : defaultFieldWrapper(field.kind))));
  $: align =
    renderer?.align ??
    field.align ??
    (useSegmented ? "center" : defaultFieldAlign(field.kind));
  $: messages = fieldIssues.map((item) => item.message);

  function update(next: unknown) {
    if (fieldReadonly || !field.set) return;
    void onChange(field.set(root, next, context));
  }

  function arrayUpdate(next: string) {
    update(
      next
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  }
</script>

{#if renderer?.wrapper === "none"}
  <svelte:component
    this={renderer.component}
    {...rendererPropsFor(renderer, {
      root,
      value,
      field,
      view,
      context,
      issues: fieldIssues,
      readonly: fieldReadonly,
      update,
      updateRoot: onChange,
    })}
  />
{:else}
  <FormField
    label={field.label}
    {align}
    as={wrapper ?? "label"}
    controlId={field.id}
    invalid={fieldIssues.length > 0}
    {messages}
  >
    {#if renderer}
      <svelte:component
        this={renderer.component}
        {...rendererPropsFor(renderer, {
          root,
          value,
          field,
          view,
          context,
          issues: fieldIssues,
          readonly: fieldReadonly,
          update,
          updateRoot: onChange,
        })}
      />
    {:else if fieldReadonly}
      <output>{formatFieldValue(field, value, root, context) || " "}</output>
    {:else if field.kind === "textarea"}
      <textarea
        id={field.id}
        rows={field.rows ?? 1}
        value={text}
        placeholder={field.placeholder}
        aria-label={field.ariaLabel ?? field.label}
        use:autosizeTextarea={text}
        on:input={(event) => update(event.currentTarget.value)}
      ></textarea>
    {:else if field.kind === "boolean"}
      <input
        id={field.id}
        type="checkbox"
        checked={value === true}
        aria-label={field.ariaLabel ?? field.label}
        on:change={(event) => update(event.currentTarget.checked)}
      />
    {:else if useSegmented}
      <SegmentedControl
        value={text}
        options={options.map((option) => option.value)}
        labels={Object.fromEntries(
          options.map((option) => [option.value, option.label]),
        )}
        ariaLabel={field.ariaLabel ?? field.label}
        onChange={update}
      />
    {:else if field.kind === "options" || field.kind === "choice"}
      <select
        id={field.id}
        value={text}
        aria-label={field.ariaLabel ?? field.label}
        on:change={(event) => update(event.currentTarget.value)}
      >
        {#each options as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    {:else if field.kind === "tag-list"}
      <TagEditor
        value={arrayValue}
        {suggestions}
        label={field.label}
        showLabel={false}
        embedded
        uppercase={false}
        id={field.id}
        placeholder={field.placeholder ?? "Add tag..."}
        onChange={update}
      />
    {:else if field.kind === "chip-list" || field.kind === "string-list"}
      <ChipAutocomplete
        value={arrayValue}
        {suggestions}
        label={field.label}
        showLabel={false}
        embedded
        uppercase={false}
        id={field.id}
        placeholder={field.placeholder ?? "Add item..."}
        onChange={update}
      />
    {:else if field.kind === "reference-list"}
      <input
        id={field.id}
        value={text}
        placeholder={field.placeholder ?? "Comma separated values"}
        aria-label={field.ariaLabel ?? field.label}
        on:input={(event) => arrayUpdate(event.currentTarget.value)}
      />
    {:else}
      <input
        id={field.id}
        type={field.kind === "date" ? "date" : (field.inputType ?? "text")}
        value={text}
        placeholder={field.placeholder}
        autocomplete={field.autocomplete}
        aria-label={field.ariaLabel ?? field.label}
        on:input={(event) => update(event.currentTarget.value)}
      />
    {/if}
  </FormField>
{/if}
