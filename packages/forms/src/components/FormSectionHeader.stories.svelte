<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FormSectionHeader from "./FormSectionHeader.svelte";

  const { Story } = defineMeta({
    title: "Forms/Form Section Header",
    component: FormSectionHeader,
    parameters: {
      docs: {
        description: {
          component:
            "The shared section and editable repeated-entry header. It owns the left-rail disclosure and hover move/remove actions. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for composition rules.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let connectionTitle = $state("Connection");
  let connectionOpen = $state(true);
  let connectionIndex = $state(1);
  let connectionRemoved = $state(false);
  let advancedOpen = $state(false);
</script>

<Story
  name="Editable section"
  play={async ({ canvas }) => {
    const title = canvas.getByRole("textbox", { name: "Section title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Ledger connection");
    await userEvent.click(
      canvas.getByRole("button", { name: "Move section up" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse Ledger connection" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Ledger connection is collapsed at position 1 of 3",
    );
  }}
>
  {#snippet template()}
    {#if connectionRemoved}
      <p role="status" class="text-muted-foreground text-sm">Section removed</p>
    {:else}
      <div class="flex max-w-md flex-col gap-2">
        <FormSectionHeader
          title={connectionTitle}
          index={connectionIndex}
          total={3}
          open={connectionOpen}
          onTitleChange={(value) => (connectionTitle = value)}
          onToggle={() => (connectionOpen = !connectionOpen)}
          onMove={(direction) => (connectionIndex += direction)}
          onRemove={() => (connectionRemoved = true)}
        />
        <output class="text-muted-foreground text-sm">
          {connectionTitle} is {connectionOpen ? "expanded" : "collapsed"} at position
          {connectionIndex + 1} of 3
        </output>
      </div>
    {/if}
  {/snippet}
</Story>

<Story
  name="Title-toggleable collapsed section"
  play={async ({ canvas }) => {
    const title = canvas.getByRole("button", { name: "Advanced options" });
    await expect(title).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(title);
    await expect(title).toHaveAttribute("aria-expanded", "true");
  }}
>
  {#snippet template()}
    <div class="max-w-md">
      <FormSectionHeader
        title="Advanced options"
        editable={false}
        titleToggleable
        open={advancedOpen}
        movable={false}
        removable={false}
        onToggle={() => (advancedOpen = !advancedOpen)}
      />
    </div>
  {/snippet}
</Story>

<Story name="First section move boundary">
  {#snippet template()}
    <div class="max-w-md">
      <FormSectionHeader
        title="First source"
        index={0}
        total={3}
        removable={false}
      />
    </div>
  {/snippet}
</Story>
