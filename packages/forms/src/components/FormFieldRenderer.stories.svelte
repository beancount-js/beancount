<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormFieldRenderer from "./FormFieldRenderer.svelte";

  const { Story } = defineMeta({
    title: "Forms/Form Field Renderer",
    component: FormFieldRenderer,
    parameters: {
      docs: {
        description: {
          component:
            "The field-level implementation used by Structured Form. It chooses a renderer from field configuration and reports validation in the shared grid. Treat it as configuration-runtime infrastructure, not as a replacement for composing shared form primitives.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { segmentedField } from "../core";

  type SourceSettings = { mode: string };

  const field = segmentedField<SourceSettings>({
    id: "import-mode",
    label: "Import mode",
    options: [
      { value: "automatic", label: "Automatic" },
      { value: "manual", label: "Manual" },
    ],
    get: (settings) => settings.mode,
    set: (settings, mode) => ({ ...settings, mode }),
  });

  let settings = $state<SourceSettings>({ mode: "automatic" });
</script>

<Story
  name="Renders a configured segmented field"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Manual" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "manual import selected",
    );
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormFieldRenderer
        root={settings}
        {field}
        onChange={(next) => (settings = next as SourceSettings)}
      />
      <output class="sr-only">{settings.mode} import selected</output>
    </div>
  {/snippet}
</Story>
