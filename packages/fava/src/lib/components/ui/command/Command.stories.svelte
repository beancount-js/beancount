<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import * as Command from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Forms/Command",
    component: Command.Root,
    parameters: {
      docs: {
        description: {
          component:
            "The local command primitive used inside keyboard-driven or compact searchable controls. Use Filter Command Picker for standard searchable form choices.",
        },
      },
    },
  });
</script>

<Story
  name="Filters a command list"
  play={async ({ canvas }) => {
    const input = canvas.getByPlaceholderText("Search accounts");
    await userEvent.type(input, "groceries");
    await expect(canvas.getByText("Expenses:Groceries")).toBeVisible();
    await expect(input).toHaveValue("groceries");
  }}
>
  {#snippet template()}
    <Command.Root class="max-w-md border">
      <Command.Input
        aria-controls="catalog-account-command-list"
        placeholder="Search accounts"
      />
      <Command.List id="catalog-account-command-list">
        <Command.Empty>No matching account.</Command.Empty>
        <Command.Group heading="Accounts">
          <Command.Item value="Assets:Cash">Assets:Cash</Command.Item>
          <Command.Item value="Expenses:Groceries"
            >Expenses:Groceries</Command.Item
          >
          <Command.Item value="Liabilities:Card">Liabilities:Card</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Root>
  {/snippet}
</Story>
