<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import * as Select from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Forms/Select",
    component: Select.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local select for a compact known option set. Use Filter Command Picker for searchable or larger application choice sets.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let currency = $state("GBP");
  const currencyLabels: Record<string, string> = {
    GBP: "Pound sterling",
    EUR: "Euro",
    USD: "US dollar",
  };
</script>

<Story
  name="Selects a known option"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Currency" }));
    const options = within(document.body);
    await userEvent.click(options.getByRole("option", { name: "US dollar" }));
    await expect(canvas.getByRole("status")).toHaveTextContent("US dollar");
  }}
>
  {#snippet template()}
    <div class="max-w-sm space-y-2">
      <span class="text-sm font-medium" id="catalog-currency-label"
        >Currency</span
      >
      <Select.Root type="single" bind:value={currency}>
        <Select.Trigger aria-labelledby="catalog-currency-label">
          {currencyLabels[currency]}
        </Select.Trigger>
        <Select.Content aria-label="Currency options">
          <Select.Item value="GBP">Pound sterling</Select.Item>
          <Select.Item value="EUR">Euro</Select.Item>
          <Select.Item value="USD">US dollar</Select.Item>
        </Select.Content>
      </Select.Root>
      <output class="block text-sm text-muted-foreground">
        {currencyLabels[currency]}
      </output>
    </div>
  {/snippet}
</Story>
