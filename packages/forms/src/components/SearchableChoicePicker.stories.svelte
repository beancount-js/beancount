<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import SearchableChoicePicker from "./SearchableChoicePicker.svelte";

  const { Story } = defineMeta({
    title: "Forms/Legacy/Searchable Choice Picker",
    component: SearchableChoicePicker,
    parameters: {
      docs: {
        description: {
          component:
            "Legacy searchable choice control retained for existing callers. Use Filter Command Picker for all new accounts, queries, facets, and enum-like choices; it is the documented and tested standard.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let account = $state("");

  const options = [
    { value: "Assets:Cash", label: "Cash account" },
    { value: "Expenses:Groceries", label: "Groceries" },
    { value: "Liabilities:Card", label: "Credit card" },
  ];
</script>

<Story
  name="Selects an existing account"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Legacy account" }),
    );
    await userEvent.click(canvas.getByText("Cash account"));
    await expect(canvas.getByRole("status")).toHaveTextContent("Assets:Cash");
  }}
>
  {#snippet template()}
    <div class="flex max-w-md flex-col gap-3">
      <SearchableChoicePicker
        value={account}
        {options}
        ariaLabel="Legacy account"
        placeholder="Choose an account"
        onChange={(value) => (account = value)}
      />
      <output class="text-sm text-muted-foreground">
        {account || "No account selected"}
      </output>
    </div>
  {/snippet}
</Story>
