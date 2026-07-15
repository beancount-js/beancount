<script lang="ts" generics="TRoot, TContext = undefined">
  import FormFieldRenderer from "./FormFieldRenderer.svelte";
  import type { FormConfig, FormValidationIssue, FormViewName } from "../types";

  export let value: TRoot;
  export let config: FormConfig<TRoot, TContext>;
  export let view: FormViewName = config.defaultView ?? "edit";
  export let context: TContext;
  export let issues: FormValidationIssue[] = [];
  export let readonly = false;
  export let onChange: (value: TRoot) => void | Promise<void> = () => {};
</script>

<div
  class="beancount-structured-form cv-structured-form"
  data-form-id={config.id}
  data-view={view}
>
  {#each config.fields as field (field.id)}
    <FormFieldRenderer
      root={value}
      {field}
      {view}
      {context}
      {issues}
      {readonly}
      {onChange}
    />
  {/each}
</div>

<style>
  .beancount-structured-form,
  .cv-structured-form {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
  }
</style>
