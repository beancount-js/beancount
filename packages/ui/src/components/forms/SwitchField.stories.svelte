<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormField from "./FormField.svelte";
  import SwitchField from "./SwitchField.svelte";
  import type { FormCustomRenderer } from "./types";

  type SwitchRoot = { pagination: boolean };

  const context = {};
  const field = {
    id: "cursor-pagination",
    label: "Cursor pagination",
    ariaLabel: "Configure cursor pagination",
  };
  const SwitchFormField = SwitchField as FormCustomRenderer<
    SwitchRoot,
    typeof context,
    boolean
  >;

  const { Story } = defineMeta({
    title: "UI Forms/Switch Field",
    component: SwitchField,
    parameters: {
      docs: {
        description: {
          component:
            "A reusable ingestion-form boolean control that renders `Yes`/`No` for read-only views and delegates editable control to the shared `Switch`.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let root = $state<SwitchRoot>({ pagination: false });
</script>

<Story
  name="Toggles a boolean setting"
  play={async ({ canvas }) => {
    const toggle = canvas.getByRole("switch", {
      name: "Configure cursor pagination",
    });
    await expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    await expect(toggle).toBeChecked();
    await expect(canvas.getByRole("status")).toHaveTextContent("Enabled");
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label={field.label} as="div" align="center">
        <SwitchFormField
          {root}
          value={root.pagination}
          {field}
          {context}
          issues={[]}
          view="edit"
          readonly={false}
          update={(value) => {
            root = { pagination: value };
          }}
          updateRoot={(value) => {
            root = value as SwitchRoot;
          }}
        />
      </FormField>
      <output class="text-sm text-muted-foreground" aria-live="polite">
        Cursor pagination: {root.pagination ? "Enabled" : "Disabled"}
      </output>
    </div>
  {/snippet}
</Story>

<Story name="Shows a read-only boolean">
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label={field.label} as="div" align="center">
        <SwitchFormField
          {root}
          value={true}
          {field}
          {context}
          issues={[]}
          view="readonly"
          readonly={true}
          update={() => {}}
          updateRoot={() => {}}
        />
      </FormField>
    </div>
  {/snippet}
</Story>
