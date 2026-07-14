<script lang="ts">
  import { defaultFieldAlign, fieldIssuesFor, formatFieldValue, rendererPropsFor, resolveFieldRenderer } from "../registry";
  import type { FormFieldConfig, FormValidationIssue, FormViewName } from "../types";

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
  $: fieldReadonly = readonly || field.readonly === true || view === "readonly" || (view !== "edit" && renderer?.interactive !== true);
  $: options = field.options ? (typeof field.options === "function" ? field.options({ root, value, field, context }) : field.options) : [];
  $: text = value == null ? "" : Array.isArray(value) ? value.join(", ") : String(value);

  function update(next: unknown) {
    if (fieldReadonly || !field.set) return;
    void onChange(field.set(root, next, context));
  }

  function arrayUpdate(next: string) { update(next.split(",").map((item) => item.trim()).filter(Boolean)); }
</script>

{#if renderer?.wrapper === "none"}
  <svelte:component this={renderer.component} {...rendererPropsFor(renderer, { root, value, field, view, context, issues: fieldIssues, readonly: fieldReadonly, update, updateRoot: onChange })} />
{:else}
  <label class="cv-form-field" data-align={renderer?.align ?? field.align ?? defaultFieldAlign(field.kind)}>
    <span>{field.label}</span>
    {#if renderer}
      <svelte:component this={renderer.component} {...rendererPropsFor(renderer, { root, value, field, view, context, issues: fieldIssues, readonly: fieldReadonly, update, updateRoot: onChange })} />
    {:else if fieldReadonly}
      <output>{formatFieldValue(field, value, root, context) || " "}</output>
    {:else if field.kind === "textarea"}
      <textarea rows={field.rows ?? 2} value={text} placeholder={field.placeholder} aria-label={field.ariaLabel ?? field.label} on:input={(event) => update(event.currentTarget.value)}></textarea>
    {:else if field.kind === "boolean"}
      <input type="checkbox" checked={value === true} aria-label={field.ariaLabel ?? field.label} on:change={(event) => update(event.currentTarget.checked)} />
    {:else if field.kind === "options" || field.kind === "choice" || field.kind === "segmented"}
      <select value={text} aria-label={field.ariaLabel ?? field.label} on:change={(event) => update(event.currentTarget.value)}>{#each options as option}<option value={option.value}>{option.label}</option>{/each}</select>
    {:else if ["string-list", "tag-list", "chip-list", "reference-list"].includes(field.kind)}
      <input value={text} placeholder={field.placeholder ?? "Comma separated values"} aria-label={field.ariaLabel ?? field.label} on:input={(event) => arrayUpdate(event.currentTarget.value)} />
    {:else}
      <input type={field.kind === "date" ? "date" : field.inputType ?? "text"} value={text} placeholder={field.placeholder} autocomplete={field.autocomplete} aria-label={field.ariaLabel ?? field.label} on:input={(event) => update(event.currentTarget.value)} />
    {/if}
    {#if field.description}<small>{field.description}</small>{/if}
    {#if fieldIssues.length}<span class="cv-form-issues">{fieldIssues.map((item) => item.message).join(" ")}</span>{/if}
  </label>
{/if}

<style>
  .cv-form-field { display: grid; gap: .35rem; color: var(--muted-foreground); font-size: .875rem; }
  .cv-form-field input, .cv-form-field textarea, .cv-form-field select { width: 100%; box-sizing: border-box; border: 1px solid hsl(var(--border)); border-radius: .375rem; padding: .45rem .6rem; background: hsl(var(--background)); color: hsl(var(--foreground)); font: inherit; }
  .cv-form-field output { color: hsl(var(--foreground)); white-space: pre-wrap; }
  .cv-form-field small { font-size: .75rem; }
  .cv-form-issues { color: hsl(var(--destructive)); font-size: .75rem; }
</style>
