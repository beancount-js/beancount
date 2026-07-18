<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import YamlBackedForm from "./YamlBackedForm.svelte";

  const { Story } = defineMeta({
    title: "Forms/YAML Backed Form",
    component: YamlBackedForm,
  });

  const yaml = `version: 1
sources:
  - id: main-card
    account: Assets:Card
`;
</script>

<Story name="YAML source mode">
  {#snippet template()}
    <YamlBackedForm yamlMode yamlText={yaml} yamlLabel="Source YAML" />
  {/snippet}
</Story>

<Story name="YAML validation error">
  {#snippet template()}
    <YamlBackedForm
      yamlMode
      yamlText="sources: ["
      yamlError="Unexpected end of YAML input."
    />
  {/snippet}
</Story>
