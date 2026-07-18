<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormField from "./FormField.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  const { Story } = defineMeta({
    title: "Forms/Form Field",
    component: FormField,
    parameters: {
      docs: {
        description: {
          component:
            'One labelled row in a shared `beancount-structured-form` grid. Use `as="div" align="center"` for pickers, switches, and segmented controls. Read the [Form guidance](?path=/docs/ui-forms-guidance--docs) before composing a form.',
        },
      },
    },
  });
</script>

<script lang="ts">
  let ledgerName = $state("Household ledger");
  let syncMode = $state("automatic");
</script>

<Story
  name="Text input"
  play={async ({ canvas }) => {
    const input = canvas.getByRole("textbox", { name: "Ledger name" });
    await userEvent.clear(input);
    await userEvent.type(input, "Northstar household");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Northstar household",
    );
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label="Ledger name" controlId="ledger-name" align="center">
        {#snippet children()}
          <input id="ledger-name" bind:value={ledgerName} />
        {/snippet}
      </FormField>
      <output class="sr-only">Ledger name: {ledgerName}</output>
    </div>
  {/snippet}
</Story>

<Story
  name="Centered interactive control"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Manual" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("manual sync");
  }}
>
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
      <FormField label="Sync mode" as="div" align="center">
        {#snippet children()}
          <SegmentedControl
            value={syncMode}
            options={["automatic", "manual"]}
            labels={{ automatic: "Automatic", manual: "Manual" }}
            ariaLabel="Ledger sync mode"
            onChange={(value) => (syncMode = value)}
          />
        {/snippet}
      </FormField>
      <output class="sr-only">{syncMode} sync</output>
    </div>
  {/snippet}
</Story>

<Story name="Validation messages">
  {#snippet template()}
    <div class="beancount-structured-form max-w-2xl">
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
