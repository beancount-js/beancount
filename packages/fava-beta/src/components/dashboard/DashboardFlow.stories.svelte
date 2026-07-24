<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import DashboardFlow from "./DashboardFlow.svelte";

  const { Story } = defineMeta({
    title: "Fava/Dashboard/Cash Flow",
    component: DashboardFlow,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's cash-flow view. Each flow path can receive keyboard focus to show its amount and contribution, while account labels retain their destinations as links; use the built-in empty state when a period has no matching activity.",
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

  const inflows = [
    {
      account: "Income:Salary",
      label: "Salary",
      value: 3400,
      color: "#10b981",
    },
    {
      account: "Income:Refunds",
      label: "Refunds",
      value: 120,
      color: "#0ea5e9",
    },
  ];

  const outflows = [
    {
      account: "Expenses:Groceries",
      label: "Groceries",
      value: 420,
      color: "#f97316",
    },
    {
      account: "Expenses:Rent",
      label: "Rent",
      value: 1300,
      color: "#8b5cf6",
    },
  ];
</script>

<Story
  name="Activates a cash-flow path"
  play={async ({ canvas }) => {
    const salary = canvas.getByRole("button", {
      name: "Salary to Cash flow: £3,400.00",
    });
    await userEvent.click(salary);
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Salary → Cash flow",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-5xl rounded-xl border bg-card shadow-sm">
      <DashboardFlow
        {inflows}
        {outflows}
        currency="GBP"
        formatter={formatAmount}
      />
    </div>
  {/snippet}
</Story>

<Story name="Explains a period without cash flow">
  {#snippet template()}
    <div class="max-w-5xl rounded-xl border bg-card shadow-sm">
      <DashboardFlow currency="GBP" formatter={formatAmount} />
    </div>
  {/snippet}
</Story>
