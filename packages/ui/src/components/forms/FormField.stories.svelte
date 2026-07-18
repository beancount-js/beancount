<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormField from "./FormField.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Form Field",
    component: FormField,
    parameters: {
      docs: {
        description: {
          component:
            'One labelled row in a `beancount-structured-form` grid. Use `as="div"` and `align="center"` for pickers, switches, segmented controls, and other interactive pills; use the default text-row alignment for borderless inputs and output.',
        },
      },
    },
  });
</script>

<script lang="ts">
  let ledgerName = $state("Household ledger");
</script>

<Story
  name="Text input"
  play={async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: "Ledger name" });
    await userEvent.clear(input);
    await userEvent.type(input, "Shared household ledger");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Shared household ledger",
    );
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-xl">
      <FormField label="Ledger name" controlId="ledger-name">
        {#snippet children()}
          <input
            id="ledger-name"
            aria-label="Ledger name"
            bind:value={ledgerName}
          />
        {/snippet}
      </FormField>
      <output class="sr-only">{ledgerName}</output>
    </div>
  {/snippet}
</Story>

<Story name="Centered interactive control">
  {#snippet template()}
    <div class="beancount-structured-form max-w-xl">
      <FormField label="Active" as="div" align="center" controlId="active">
        {#snippet children()}
          <button id="active" type="button">Enabled</button>
        {/snippet}
      </FormField>
    </div>
  {/snippet}
</Story>

<Story name="Validation messages">
  {#snippet template()}
    <div class="beancount-structured-form max-w-xl">
      <FormField
        label="Project folder"
        controlId="project-folder"
        invalid
        messages={["Choose an existing folder."]}
      >
        {#snippet children()}
          <input id="project-folder" aria-invalid="true" value="/missing" />
        {/snippet}
      </FormField>
    </div>
  {/snippet}
</Story>
