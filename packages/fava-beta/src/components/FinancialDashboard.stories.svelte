<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FinancialDashboard from "./FinancialDashboard.svelte";

  const { Story } = defineMeta({
    title: "Fava/Dashboard/Financial Dashboard",
    component: FinancialDashboard,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's ledger overview. It composes the period summary, cash-flow and outflow visualizations, balance-sheet account trees, and net-worth trend from the same filtered ledger context used by reports.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import {
    createStudioWorkspace,
    setStudioWorkspace,
  } from "../studio/workspace";

  const context = createContext();
  context.ledgerSource.set(
    new LedgerSource(
      `
        option "operating_currency" "GBP"
        2026-01-01 open Assets:Cash GBP
        2026-01-01 open Expenses:Groceries GBP
        2026-01-01 open Expenses:Rent GBP
        2026-01-01 open Income:Salary GBP
        2026-01-01 open Equity:Opening-Balances GBP
        2026-01-01 * "Opening balance"
          Assets:Cash                 1,000.00 GBP
          Equity:Opening-Balances    -1,000.00 GBP
        2026-05-01 * "Salary"
          Assets:Cash                 3,400.00 GBP
          Income:Salary              -3,400.00 GBP
        2026-05-03 * "Groceries"
          Expenses:Groceries            420.00 GBP
          Assets:Cash                   -420.00 GBP
        2026-05-05 * "Rent"
          Expenses:Rent               1,300.00 GBP
          Assets:Cash                -1,300.00 GBP
        2026-06-01 * "Salary"
          Assets:Cash                 3,400.00 GBP
          Income:Salary              -3,400.00 GBP
        2026-06-03 * "Groceries"
          Expenses:Groceries            385.00 GBP
          Assets:Cash                   -385.00 GBP
        2026-07-01 * "Salary"
          Assets:Cash                 3,400.00 GBP
          Income:Salary              -3,400.00 GBP
        2026-07-04 * "Groceries"
          Expenses:Groceries            460.00 GBP
          Assets:Cash                   -460.00 GBP
      `,
      { logTimings: undefined },
    ),
  );
  setContext(ContextKey, context);

  const workspace = createStudioWorkspace(
    async () => {},
    async () => ({}) as never,
    async () => null,
    async () => ({ url: "", mimeType: "text/plain" }),
    () => {},
  );
  setStudioWorkspace(workspace);
</script>

<Story
  name="Shows an interactive ledger overview"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { name: "Financial dashboard" }),
    ).toBeVisible();

    const atMarketValue = canvas.getByRole("radio", {
      name: "At Market Value",
    });
    await userEvent.click(atMarketValue);
    await expect(atMarketValue).toHaveAttribute("aria-checked", "true");
  }}
>
  {#snippet template()}
    <div
      class="h-[52rem] max-w-[90rem] overflow-hidden rounded-xl border bg-background shadow-sm"
    >
      <FinancialDashboard />
    </div>
  {/snippet}
</Story>
