<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import IntervalTreeTable from "./IntervalTreeTable.svelte";

  const { Story } = defineMeta({
    title: "Fava/Data Display/Interval Account Tree Table",
    component: IntervalTreeTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's multi-period account-hierarchy table. It compares balances and optional budgets across supplied date ranges, while preserving the same account disclosure controls as the standard account tree.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { DateTime } from "luxon";
  import { DateRange } from "@beancount-js/filters";
  import type { AccountBudget, AccountTreeNode } from "../../core/account";
  import { ContextKey, createContext } from "../../context";
  import { LedgerSource } from "../../core/ledger";
  import {
    createStudioWorkspace,
    setStudioWorkspace,
  } from "../../studio/workspace";

  const context = createContext();
  context.ledgerSource.set(
    new LedgerSource(
      `option "operating_currency" "GBP"
2026-01-01 open Expenses:Groceries GBP
2026-01-01 open Expenses:Dining GBP`,
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

  const periodOne = {
    account: "",
    balance: {},
    balanceChildren: { GBP: 250 },
    cost: {},
    costChildren: { GBP: 250 },
    hasTxns: false,
    children: [
      {
        account: "Expenses",
        balance: {},
        balanceChildren: { GBP: 250 },
        cost: {},
        costChildren: { GBP: 250 },
        hasTxns: false,
        children: [
          {
            account: "Expenses:Groceries",
            balance: { GBP: 180 },
            balanceChildren: { GBP: 180 },
            cost: { GBP: 180 },
            costChildren: { GBP: 180 },
            hasTxns: true,
            children: [],
          },
          {
            account: "Expenses:Dining",
            balance: { GBP: 70 },
            balanceChildren: { GBP: 70 },
            cost: { GBP: 70 },
            costChildren: { GBP: 70 },
            hasTxns: true,
            children: [],
          },
        ],
      },
    ],
  } satisfies AccountTreeNode;

  const periodTwo = {
    account: "",
    balance: {},
    balanceChildren: { GBP: 310 },
    cost: {},
    costChildren: { GBP: 310 },
    hasTxns: false,
    children: [
      {
        account: "Expenses",
        balance: {},
        balanceChildren: { GBP: 310 },
        cost: {},
        costChildren: { GBP: 310 },
        hasTxns: false,
        children: [
          {
            account: "Expenses:Groceries",
            balance: { GBP: 210 },
            balanceChildren: { GBP: 210 },
            cost: { GBP: 210 },
            costChildren: { GBP: 210 },
            hasTxns: true,
            children: [],
          },
          {
            account: "Expenses:Dining",
            balance: { GBP: 100 },
            balanceChildren: { GBP: 100 },
            cost: { GBP: 100 },
            costChildren: { GBP: 100 },
            hasTxns: true,
            children: [],
          },
        ],
      },
    ],
  } satisfies AccountTreeNode;

  const dates = [
    new DateRange(
      DateTime.fromISO("2026-06-01"),
      DateTime.fromISO("2026-07-01"),
    ),
    new DateRange(
      DateTime.fromISO("2026-07-01"),
      DateTime.fromISO("2026-08-01"),
    ),
  ];

  const budgets = {
    Expenses: [
      { budget: {}, budgetChildren: { GBP: 280 } },
      { budget: {}, budgetChildren: { GBP: 320 } },
    ],
    "Expenses:Groceries": [
      { budget: { GBP: 200 }, budgetChildren: { GBP: 200 } },
      { budget: { GBP: 220 }, budgetChildren: { GBP: 220 } },
    ],
    "Expenses:Dining": [
      { budget: { GBP: 80 }, budgetChildren: { GBP: 80 } },
      { budget: { GBP: 100 }, budgetChildren: { GBP: 100 } },
    ],
  } satisfies Record<string, AccountBudget[]>;
</script>

<Story
  name="Compares periods and preserves account disclosure"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse Expenses" }),
    );
    await expect(
      canvas.queryByRole("link", { name: "Groceries" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Expand Expenses" }),
    );
    await expect(canvas.getByRole("link", { name: "Groceries" })).toBeVisible();
  }}
>
  {#snippet template()}
    <div
      class="max-w-5xl overflow-hidden rounded-xl border bg-card p-5 shadow-sm"
    >
      <IntervalTreeTable
        trees={[periodOne, periodTwo]}
        {dates}
        {budgets}
        accumulate={false}
      />
    </div>
  {/snippet}
</Story>
