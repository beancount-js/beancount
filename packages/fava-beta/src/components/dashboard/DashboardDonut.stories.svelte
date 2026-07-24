<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import DashboardDonut from "./DashboardDonut.svelte";

  const { Story } = defineMeta({
    title: "Fava/Dashboard/Outflow Donut",
    component: DashboardDonut,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's outflow-category chart. It keeps account destinations available as links while hover and keyboard focus reveal the selected category at the centre; show its empty state when a dashboard period has no outflows.",
        },
      },
    },
  });

  const formatAmount = (value: number, currency: string) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);

  const categories = [
    {
      account: "Expenses:Groceries",
      label: "Groceries",
      value: 420,
      color: "#f97316",
    },
    {
      account: "Expenses:Utilities",
      label: "Utilities",
      value: 180,
      color: "#3b82f6",
    },
  ];
</script>

<Story
  name="Highlights an outflow category"
  play={async ({ canvas }) => {
    const groceries = canvas.getByRole("link", { name: /Groceries/ });
    await userEvent.hover(groceries);
    await expect(canvas.getByText("Groceries")).toBeVisible();
    await expect(canvas.getByText("£420.00")).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-md rounded-xl border bg-card shadow-sm">
      <DashboardDonut {categories} currency="GBP" formatter={formatAmount} />
    </div>
  {/snippet}
</Story>

<Story name="Explains a period without outflows">
  {#snippet template()}
    <div class="max-w-md rounded-xl border bg-card shadow-sm">
      <DashboardDonut currency="GBP" formatter={formatAmount} />
    </div>
  {/snippet}
</Story>
