<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import FormField from "./FormField.svelte";

  const { Story } = defineMeta({
    title: "Forms/Form Field",
    component: FormField,
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
