<script lang="ts">
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import type { AccountTreeNode } from "../../lib/models";
  import { getAllNodes } from "../tree-table/helpers";
  import DashboardTreeRow from "./DashboardTreeRow.svelte";
  import { dashboardCategoryColor } from "./model";
  import * as ScrollArea from "@lapismd/design-core/shadcn/scroll-area";

  export let tree: AccountTreeNode;
  export let title: string;
  export let href: string;
  export let currency: string;
  export let formatter: (value: number, currency: string) => string;
  export let multiplier = 1;

  let collapsed = new Set<string>();
  let roots: AccountTreeNode[] = [];
  let collapsibleAccounts = new Set<string>();
  let total = 0;
  let contributionNodes: AccountTreeNode[] = [];
  let contributionTotal = 0;
  let contributions: Array<{
    account: string;
    amount: number;
    color: string;
    percentage: number;
  }> = [];

  $: roots = tree.account === "" ? tree.children : [tree];
  $: collapsibleAccounts = roots.reduce((accounts, root) => {
    getAllNodes(root).forEach((account) => accounts.add(account));
    return accounts;
  }, new Set<string>());
  $: allCollapsed =
    collapsibleAccounts.size > 0 &&
    [...collapsibleAccounts].every((account) => collapsed.has(account));
  $: total = roots.reduce(
    (sum, root) => sum + (root.balanceChildren[currency] ?? 0) * multiplier,
    0,
  );
  $: contributionNodes = roots.flatMap((root) =>
    root.children.length ? root.children : [root],
  );
  $: contributionTotal = contributionNodes.reduce(
    (sum, node) =>
      sum + Math.abs((node.balanceChildren[currency] ?? 0) * multiplier),
    0,
  );
  $: contributions = contributionNodes
    .map((node) => {
      const amount = (node.balanceChildren[currency] ?? 0) * multiplier;
      return {
        account: node.account,
        amount,
        color: dashboardCategoryColor(node.account),
        percentage: contributionTotal
          ? (Math.abs(amount) / contributionTotal) * 100
          : 0,
      };
    })
    .filter((contribution) => contribution.amount);

  function toggle(account: string) {
    const next = new Set(collapsed);
    if (next.has(account)) next.delete(account);
    else next.add(account);
    collapsed = next;
  }

  function toggleAll() {
    collapsed = allCollapsed ? new Set() : new Set(collapsibleAccounts);
  }
</script>

<section class="w-full min-w-0" data-dashboard-tree-table>
  <div class="flex items-baseline justify-between gap-4">
    <h2 class="text-lg font-semibold tracking-tight text-foreground">
      {title}
      <span class="font-mono text-base font-medium text-muted-foreground"
        >· {total ? formatter(total, currency) : "—"}</span
      >
    </h2>
    <a class="text-xs font-medium text-primary hover:underline" {href}
      >View account</a
    >
  </div>
  <div
    class="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
    role="img"
    aria-label={`${title} category contributions`}
  >
    {#each contributions as contribution (contribution.account)}
      <span
        class="h-full first:rounded-l-full last:rounded-r-full"
        style={`width: ${contribution.percentage}%; background: ${contribution.color}`}
        title={`${contribution.account}: ${formatter(contribution.amount, currency)}`}
      ></span>
    {/each}
  </div>
  <div
    class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"
  >
    {#each contributions as contribution (contribution.account)}
      <span class="flex items-center gap-2">
        <span
          class="size-2.5 shrink-0 rounded-full"
          style={`background: ${contribution.color}`}
          aria-hidden="true"
        ></span>
        <span>{contribution.account.split(":").at(-1)}</span>
        <span class="font-mono text-xs tabular-nums text-foreground"
          >{contribution.percentage.toFixed(1)}%</span
        >
      </span>
    {/each}
  </div>
  <ScrollArea.Root
    orientation="horizontal"
    class="mt-4 w-full min-w-0 max-w-full rounded-xl"
  >
    <ol
      class="min-w-[42rem] overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
      data-dashboard-tree-rows
    >
      <li
        class="grid min-h-10 grid-cols-[minmax(0,1fr)_8rem_10rem] items-center bg-muted/65 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        <span class="flex items-center gap-2 px-4 py-2">
          <button
            type="button"
            class="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
            aria-label={allCollapsed
              ? "Expand all accounts"
              : "Collapse all accounts"}
            aria-pressed={allCollapsed}
            title={allCollapsed
              ? "Expand all accounts"
              : "Collapse all accounts"}
            on:click={toggleAll}
          >
            <ChevronsUpDown class="size-3" />
          </button>
          Account
        </span>
        <span class="px-4 py-2 text-right">Weight</span>
        <span class="px-4 py-2 text-right">Value</span>
      </li>
      {#each roots as root (root.account)}
        <DashboardTreeRow
          node={root}
          {currency}
          {formatter}
          {multiplier}
          {total}
          {collapsed}
          {toggle}
          branchColor="var(--primary)"
        />
      {/each}
    </ol>
  </ScrollArea.Root>
</section>
