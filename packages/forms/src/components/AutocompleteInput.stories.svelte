<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import AutocompleteInput from "./AutocompleteInput.svelte";

  const { Story } = defineMeta({
    title: "Forms/Legacy/Autocomplete Input",
    component: AutocompleteInput,
    parameters: {
      docs: {
        description: {
          component:
            "Compatibility autocomplete input for existing multi-value editors. Do not use it for new searchable selections: use Filter Command Picker, which has the canonical form treatment and accessible option model.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let value = $state("");
  let committed = $state("");
</script>

<Story
  name="Commits a suggested account with the keyboard"
  play={async ({ canvas }) => {
    const input = canvas.getByRole("combobox", { name: "Legacy account" });
    await userEvent.click(input);
    await userEvent.type(input, "cash");
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("status")).toHaveTextContent("Assets:Cash");
  }}
>
  {#snippet template()}
    <div class="flex max-w-md flex-col gap-3">
      <AutocompleteInput
        bind:value
        suggestions={[
          "Assets:Cash",
          "Assets:Bank:Checking",
          "Expenses:Groceries",
        ]}
        ariaLabel="Legacy account"
        placeholder="Type an account"
        onCommit={(next) => (committed = next)}
      />
      <output class="text-sm text-muted-foreground">
        {committed || "No account committed"}
      </output>
    </div>
  {/snippet}
</Story>
