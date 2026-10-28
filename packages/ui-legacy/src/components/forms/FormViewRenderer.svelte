<script lang="ts" generics="TRoot, TContext = undefined">
  import StructuredForm from "./StructuredForm.svelte";
  import type { FormConfig, FormValidationIssue, FormViewName } from "./types";
  export let value: TRoot;
  export let config: FormConfig<TRoot, TContext>;
  export let context: TContext;
  export let view: FormViewName = "preview";
  export let issues: FormValidationIssue[] = [];
</script>

<StructuredForm {value} {config} {context} {view} {issues} readonly />
