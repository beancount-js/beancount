<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import FormField from "./FormField.svelte";

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

<Story
  name="Text input"
  args={{ label: "Ledger name", controlId: "ledger-name" }}
>
  {#snippet children()}
    <input id="ledger-name" value="Household ledger" />
  {/snippet}
</Story>

<Story
  name="Centered interactive control"
  args={{
    label: "Active",
    as: "div",
    align: "center",
    controlId: "active",
  }}
>
  {#snippet children()}
    <button id="active" type="button">Enabled</button>
  {/snippet}
</Story>

<Story
  name="Validation messages"
  args={{
    label: "Project folder",
    controlId: "project-folder",
    invalid: true,
    messages: ["Choose an existing folder."],
  }}
>
  {#snippet children()}
    <input id="project-folder" aria-invalid="true" value="/missing" />
  {/snippet}
</Story>
