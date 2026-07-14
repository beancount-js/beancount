<script lang="ts" generics="TRoot, TContext = undefined">
  import StructuredForm from "./StructuredForm.svelte";
  import type { FormValidationIssue, FormViewName, YamlBackedFormConfig } from "../types";
  export let value: TRoot;
  export let config: YamlBackedFormConfig<TRoot, TContext>;
  export let context: TContext;
  export let view: FormViewName = "edit";
  export let issues: FormValidationIssue[] = [];
  export let readonly = false;
  export let onChange: (value: TRoot) => void | Promise<void> = () => {};
</script>

<StructuredForm {value} {config} {context} {view} {issues} {readonly} {onChange} />
