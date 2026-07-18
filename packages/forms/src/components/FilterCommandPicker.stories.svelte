<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";

  const { Story } = defineMeta({
    title: "Forms/Filter Command Picker",
    component: FilterCommandPicker,
  });

  const accountOptions = [
    {
      value: "Assets:Cash",
      label: "Assets:Cash",
      description: "Cash on hand",
      accent: "oklch(56% 0.14 160)",
    },
    {
      value: "Expenses:Groceries",
      label: "Expenses:Groceries",
      description: "Food and household shopping",
      accent: "oklch(70% 0.14 75)",
    },
    {
      value: "Liabilities:Card",
      label: "Liabilities:Card",
      description: "Credit card balance",
      accent: "oklch(60% 0.18 25)",
    },
  ];
</script>

<Story
  name="Single selection"
  args={{
    label: "Account",
    value: "Assets:Cash",
    options: accountOptions,
  }}
/>

<Story
  name="Multiple full-width selection"
  args={{
    label: "Accounts",
    multiple: true,
    values: ["Assets:Cash", "Expenses:Groceries"],
    fullWidth: true,
    options: accountOptions,
  }}
/>

<Story
  name="Custom value"
  args={{ label: "Environment variable", allowCustom: true, options: [] }}
/>
