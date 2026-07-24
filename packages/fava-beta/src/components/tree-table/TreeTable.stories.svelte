<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import TreeTable from "./TreeTable.svelte";

  const { Story } = defineMeta({
    title: "Fava/Data Display/Account Tree Table",
    component: TreeTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's reusable account-hierarchy balance table. It provides account disclosure, hierarchy-wide fold/unfold actions, and per-currency values for report surfaces that supply an account tree.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { DateTime } from "luxon";
  import type { AccountTreeNode } from "../../core/account";
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
2026-01-01 open Assets:Cash GBP
2026-01-01 open Assets:Bank GBP`,
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

  const tree = {
    account: "",
    balance: {},
    balanceChildren: { GBP: 1510 },
    cost: {},
    costChildren: { GBP: 1510 },
    hasTxns: false,
    children: [
      {
        account: "Assets",
        balance: {},
        balanceChildren: { GBP: 1510 },
        cost: {},
        costChildren: { GBP: 1510 },
        hasTxns: false,
        children: [
          {
            account: "Assets:Cash",
            balance: { GBP: 510 },
            balanceChildren: { GBP: 510 },
            cost: { GBP: 510 },
            costChildren: { GBP: 510 },
            hasTxns: true,
            children: [],
          },
          {
            account: "Assets:Bank",
            balance: { GBP: 1000 },
            balanceChildren: { GBP: 1000 },
            cost: { GBP: 1000 },
            costChildren: { GBP: 1000 },
            hasTxns: true,
            children: [],
          },
        ],
      },
    ],
  } satisfies AccountTreeNode;
</script>

<Story
  name="Folds and unfolds the account hierarchy"
  play={async ({ canvas }) => {
    const foldAll = canvas.getByRole("button", { name: "Fold All" });
    await userEvent.click(foldAll);
    await expect(
      canvas.queryByRole("link", { name: "Cash" }),
    ).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: "Unfold All" }));
    await expect(canvas.getByRole("link", { name: "Cash" })).toBeVisible();
  }}
>
  {#snippet template()}
    <div
      class="max-w-5xl overflow-hidden rounded-xl border bg-card p-5 shadow-sm"
    >
      <TreeTable {tree} end={DateTime.fromISO("2026-07-19")} />
    </div>
  {/snippet}
</Story>
