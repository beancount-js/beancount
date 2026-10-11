<script lang="ts">
  import {
    SecretField,
    type FormFieldRenderArgs,
  } from "@lapismd/design-core/forms";
  let {
    value,
    field,
    context,
    readonly = false,
    update,
    envPlaceholder,
  }: FormFieldRenderArgs<unknown, { envKeys?: string[] }, string> & {
    envPlaceholder?: string;
  } = $props();
</script>

<SecretField
  {value}
  label={field.label}
  ariaLabel={field.ariaLabel ?? field.label}
  environmentKeys={context?.envKeys}
  environmentPlaceholder={envPlaceholder}
  readOnly={readonly}
  onChange={update}
/>
