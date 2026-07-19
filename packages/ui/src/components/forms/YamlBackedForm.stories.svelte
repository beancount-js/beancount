<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import YamlBackedForm from "./YamlBackedForm.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/YAML Backed Form",
    component: YamlBackedForm,
    parameters: {
      docs: {
        description: {
          component:
            "The shared editor for authoritative YAML drafts and validation errors. Do not use a plain textarea for YAML. Read the [Form guidance](?path=/docs/ui-forms-guidance--docs) for the YAML editing contract.",
        },
      },
    },
  });

  const yaml = `version: 1
sources:
  - id: main-card
    account: Assets:Card
`;
</script>

<script lang="ts">
  let yamlSource = $state(yaml);
  let yamlApplied = $state(false);
</script>

<Story
  name="YAML source mode"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Apply YAML" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "YAML draft applied",
    );
  }}
>
  {#snippet template()}
    <div class="flex max-w-2xl flex-col gap-3">
      <YamlBackedForm
        yamlMode
        bind:yamlText={yamlSource}
        yamlLabel="Source YAML"
        yamlMinHeight="14rem"
        onYamlApply={() => {
          yamlApplied = true;
        }}
      />
      <output class="text-sm text-muted-foreground">
        {yamlApplied ? "YAML draft applied" : "YAML draft not applied"}
      </output>
    </div>
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
