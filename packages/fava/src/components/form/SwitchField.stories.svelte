<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { FormField, type FormCustomRenderer } from "@beancount-js/forms";
  import {
    switchField,
    type SourceFormContext,
  } from "../../ingestion/source-form-config";
  import SwitchField from "./SwitchField.svelte";

  type SwitchRoot = { pagination: boolean };

  const context: SourceFormContext = { accounts: [] };
  const field = switchField<SwitchRoot>({
    id: "cursor-pagination",
    label: "Cursor pagination",
    ariaLabel: "Configure cursor pagination",
    get: (root) => root.pagination,
    set: (root, pagination) => ({ ...root, pagination }),
  });
  const SwitchFormField = SwitchField as FormCustomRenderer<
    SwitchRoot,
    SourceFormContext,
    boolean
  >;

  const { Story } = defineMeta({
    title: "Fava/Forms/Switch Field",
    component: SwitchField,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's ingestion-form adapter for an existing local shadcn Switch. It is placed in a centered structured-form row and exposes the correct switch state. New cross-app forms use the shared UI Switch; see the [Form guidance](?path=/docs/ui-forms-guidance--docs).",
        },
      },
    },
  });
</script>

<script lang="ts">
  let root = $state<SwitchRoot>({ pagination: false });

  function update(value: boolean) {
    root = field.set?.(root, value, context) ?? root;
  }
</script>

<Story
  name="Toggles cursor pagination"
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
          {update}
          updateRoot={(value) => {
            root = value;
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
          {update}
          updateRoot={() => {}}
        />
      </FormField>
    </div>
  {/snippet}
</Story>
