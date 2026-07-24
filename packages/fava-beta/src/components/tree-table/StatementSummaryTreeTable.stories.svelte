<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import StatementSummaryTreeTable from "./StatementSummaryTreeTable.svelte";

  const { Story } = defineMeta({
    title: "Fava/Data Display/Statement Summary Tree Table",
    component: StatementSummaryTreeTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's statement-summary account hierarchy. It combines contribution context, account navigation, and a responsive expandable financial table; report pages should supply the account tree instead of recreating this summary layout.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import type { AccountTreeNode } from "../../core/account";
  import { ContextKey, createContext } from "../../context";
  import { LedgerSource } from "../../core/ledger";
  import {
    createStudioWorkspace,
    setStudioWorkspace,
  } from "../../studio/workspace";

  const context = createContext();
  context.ledgerSource.set(
    new LedgerSource('option "operating_currency" "GBP"', {
      logTimings: undefined,
    }),
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
  name="Collapses and expands the account hierarchy"
  play={async ({ canvas }) => {
    const collapseAll = canvas.getByRole("button", {
      name: "Collapse all accounts",
    });
    await userEvent.click(collapseAll);
    await expect(collapseAll).toHaveAttribute("aria-pressed", "true");
    await expect(
      canvas.queryByRole("link", { name: "Cash" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Expand all accounts" }),
    );
    await expect(canvas.getByRole("link", { name: "Cash" })).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="max-w-5xl rounded-xl border bg-card p-5 shadow-sm">
      <StatementSummaryTreeTable title="Assets" href="/account/Assets" {tree} />
    </div>
  {/snippet}
</Story>
