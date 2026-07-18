<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";

  const { Story } = defineMeta({
    title: "Forms/Filter Command Picker",
    component: FilterCommandPicker,
    parameters: {
      docs: {
        description: {
          component:
            "The canonical searchable picker for accounts, enum-like values, and filter choices. In forms, place it in `FormField as=\"div\" align=\"center\"` and use `fullWidth`; enable `allowCustom` only when users may supply a value outside the option list.",
        },
      },
    },
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

<script lang="ts">
  let account = $state("Assets:Cash");
  let accounts = $state(["Assets:Cash", "Expenses:Groceries"]);
  let environmentVariable = $state("");
</script>

<Story name="Single selection">
  {#snippet template()}
    <div class="space-y-3">
      <FilterCommandPicker
        label="Account"
        value={account}
        options={accountOptions}
        onChange={(value) => {
          account = value;
        }}
      />
      <p class="text-muted-foreground text-sm">
        Selected account:
        <output class="text-foreground font-medium" aria-live="polite"
          >{account || "No account selected"}</output
        >
      </p>
    </div>
  {/snippet}
</Story>

<Story name="Multiple full-width selection">
  {#snippet template()}
    <div class="max-w-md space-y-3">
      <FilterCommandPicker
        label="Accounts"
        multiple
        values={accounts}
        fullWidth
        options={accountOptions}
        onValuesChange={(values) => {
          accounts = values;
        }}
      />
      <p class="text-muted-foreground text-sm">
        Selected accounts:
        <output class="text-foreground font-medium" aria-live="polite"
          >{accounts.length > 0 ? accounts.join(", ") : "All accounts"}</output
        >
      </p>
    </div>
  {/snippet}
</Story>

<Story name="Custom value">
  {#snippet template()}
    <div class="space-y-3">
      <FilterCommandPicker
        label="Environment variable"
        value={environmentVariable}
        allowCustom
        options={[]}
        onChange={(value) => {
          environmentVariable = value;
        }}
      />
      <p class="text-muted-foreground text-sm">
        Selected value:
        <output class="text-foreground font-medium" aria-live="polite"
          >{environmentVariable || "No value selected"}</output
        >
      </p>
    </div>
  {/snippet}
</Story>
