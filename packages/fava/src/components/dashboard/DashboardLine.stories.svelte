<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import DashboardLine from "./DashboardLine.svelte";

  const { Story } = defineMeta({
    title: "Fava/Dashboard/Net Worth Line",
    component: DashboardLine,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's dashboard net-worth trend. It is a keyboard-explorable time series that reports the active date and value to assistive technology; use its explicit empty state when there is not enough ledger history to chart.",
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
</script>

<Story
  name="Explores a net-worth trend with the keyboard"
  play={async ({ canvas }) => {
    const chart = canvas.getByRole("slider", {
      name: "Explore net worth by date",
    });
    chart.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await expect(chart).toHaveAttribute("aria-valuenow", "1");
    await expect(canvas.getByRole("status")).toHaveTextContent("£1,425.00");
  }}
>
  {#snippet template()}
    <div class="max-w-4xl rounded-xl border bg-card p-4 shadow-sm">
      <DashboardLine
        points={[
          { date: new Date("2026-05-01"), value: 1240 },
          { date: new Date("2026-06-01"), value: 1425 },
          { date: new Date("2026-07-01"), value: 1510 },
        ]}
        currency="GBP"
        change={270}
        formatter={formatAmount}
      />
    </div>
  {/snippet}
</Story>

<Story name="Explains when a longer history is needed">
  {#snippet template()}
    <div class="max-w-4xl rounded-xl border bg-card p-4 shadow-sm">
      <DashboardLine
        points={[{ date: new Date("2026-07-01"), value: 1510 }]}
        currency="GBP"
        formatter={formatAmount}
      />
    </div>
  {/snippet}
</Story>
