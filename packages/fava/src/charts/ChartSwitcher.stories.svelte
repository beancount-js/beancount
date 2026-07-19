<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import ChartSwitcher from "./ChartSwitcher.svelte";

  const { Story } = defineMeta({
    title: "Fava/Charts/Chart Switcher",
    component: ChartSwitcher,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's chart perspective selector. It keeps related chart views in one responsive region and persists the selected perspective through the ledger context.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import { balances } from "./line";

  const context = createContext();
  context.ledgerSource.set(
    new LedgerSource('option "operating_currency" "GBP"', {
      logTimings: undefined,
    }),
  );
  setContext(ContextKey, context);
  const { lastActiveChartName } = context;

  const charts = [
    balances("Net worth", [
      { date: new Date("2026-05-01"), balance: { GBP: 1240 } },
      { date: new Date("2026-06-01"), balance: { GBP: 1425 } },
      { date: new Date("2026-07-01"), balance: { GBP: 1510 } },
    ]),
    balances("Monthly spending", [
      { date: new Date("2026-05-01"), balance: { GBP: -420 } },
      { date: new Date("2026-06-01"), balance: { GBP: -385 } },
      { date: new Date("2026-07-01"), balance: { GBP: -460 } },
    ]),
  ];
</script>

<Story
  name="Switches between chart perspectives"
  play={async ({ canvas }) => {
    const spending = canvas.getByRole("tab", { name: "Monthly spending" });
    await userEvent.click(spending);
    await expect(spending).toHaveAttribute("data-state", "active");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Monthly spending",
    );
  }}
>
  {#snippet template()}
    <div class="max-w-4xl rounded-xl border bg-card p-4 shadow-sm">
      <ChartSwitcher {charts} />
    </div>
    <output class="sr-only" aria-live="polite">
      Active chart: {$lastActiveChartName ?? charts[0].name}
    </output>
  {/snippet}
</Story>
