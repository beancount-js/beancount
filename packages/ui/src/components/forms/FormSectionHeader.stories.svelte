<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormSectionHeader from "./FormSectionHeader.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Form Section Header",
    component: FormSectionHeader,
    parameters: {
      docs: {
        description: {
          component:
            "The shared header for form sections and repeatable entries. It owns the left-rail disclosure and hover move/delete actions; default titles are editable, while fixed titles should use `titleToggleable` so the whole title row collapses the section. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for section rules.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let title = $state("Connection");
  let open = $state(true);
  let collapsedOpen = $state(false);
</script>

<Story
  name="Editable section"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse Connection" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("Collapsed");
  }}
>
  {#snippet template()}
    <div class="max-w-xl space-y-2">
      <FormSectionHeader
        {title}
        {open}
        index={1}
        total={3}
        onTitleChange={(value) => (title = value)}
        onToggle={() => (open = !open)}
      />
      <output>{open ? "Expanded" : "Collapsed"}</output>
    </div>
  {/snippet}
</Story>

<Story
  name="Title-toggleable collapsed section"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Advanced options" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("Expanded");
  }}
>
  {#snippet template()}
    <div class="max-w-xl space-y-2">
      <FormSectionHeader
        title="Advanced options"
        editable={false}
        titleToggleable
        open={collapsedOpen}
        movable={false}
        removable={false}
        onToggle={() => (collapsedOpen = !collapsedOpen)}
      />
      <output>{collapsedOpen ? "Expanded" : "Collapsed"}</output>
    </div>
  {/snippet}
</Story>

<Story name="First section move boundary">
  {#snippet template()}
    <div class="max-w-xl">
      <FormSectionHeader
        title="First source"
        index={0}
        total={3}
        removable={false}
      />
    </div>
  {/snippet}
</Story>
