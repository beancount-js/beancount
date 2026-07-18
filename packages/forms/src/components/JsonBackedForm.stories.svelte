<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import JsonBackedForm from "./JsonBackedForm.svelte";

  const { Story } = defineMeta({
    title: "Forms/JSON Backed Form",
    component: JsonBackedForm,
    parameters: {
      docs: {
        description: {
          component:
            "The compatibility source-editor mode for structured JSON drafts. Prefer YAML Backed Form for new user-authored configuration; this component remains catalogued for existing JSON workflows.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let jsonText = $state('{\n  "sources": []\n}');
  let applied = $state(false);
  const invalidJson = '{ "sources": [';
</script>

<Story
  name="Applies a JSON source draft"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Apply JSON" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "JSON draft applied",
    );
  }}
>
  {#snippet template()}
    <div class="flex max-w-2xl flex-col gap-3">
      <JsonBackedForm
        jsonMode
        bind:jsonText
        jsonLabel="Ledger JSON"
        jsonMinHeight="12rem"
        onJsonApply={() => (applied = true)}
      />
      <output class="text-sm text-muted-foreground">
        {applied ? "JSON draft applied" : "JSON draft not applied"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows JSON validation feedback">
  {#snippet template()}
    <JsonBackedForm
      jsonMode
      jsonText={invalidJson}
      jsonError="Unexpected end of JSON input."
      jsonMinHeight="10rem"
    />
  {/snippet}
</Story>
