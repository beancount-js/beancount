<script lang="ts">
  import { writable } from "svelte/store";
  import type { AccountTreeNode } from "../../lib/models";
  import { useCollapseAccount, useInvertAccount } from "../../stores/account";
  import { useContext } from "../../context";
  import { useCtx } from "../../stores/format";
  import { dashboardCategoryColor } from "../dashboard/model";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import { getAllNodes, getCollapsed, useGetNotShown } from "./helpers";
  import StatementSummaryTreeRow from "./StatementSummaryTreeRow.svelte";
  import type { DateTime } from "luxon";
  import * as ScrollArea from "$lib/components/ui/scroll-area";

  export let tree: AccountTreeNode;
  export let title: string;
  export let href: string | undefined = undefined;
  export let end: DateTime | null = null;
  export let multiplier = 1;

  const { currencyName, operatingCurrency } = useContext();
  const ctx = useCtx();
  const collapseAccount = useCollapseAccount();
  const invertAccount = useInvertAccount();
  const getNotShown = useGetNotShown();
  const collapsed = writable(getCollapsed(tree, $collapseAccount));
  const hiddenAccounts = writable(new Set<string>());
  const accountColumn = "16rem";
  const weightMeterColumn = "4.5rem";
  const weightColumn = "5.5rem";
  let roots: AccountTreeNode[] = [];
  let collapsibleAccounts = new Set<string>();
  let total = 0;
  let weightTotal = 0;
  let contributionNodes: AccountTreeNode[] = [];
  let contributionTotal = 0;
  let contributions: Array<{
    account: string;
    amount: number;
    color: string;
    percentage: number;
  }> = [];

  $: $hiddenAccounts = $getNotShown(tree, end);
  $: roots = (tree.account === "" ? tree.children : [tree]).filter(
    (node: AccountTreeNode) => !$hiddenAccounts.has(node.account),
  );
  $: collapsibleAccounts = roots.reduce((accounts, root) => {
    getAllNodes(root).forEach((account) => accounts.add(account));
    return accounts;
  }, new Set<string>());
  $: allCollapsed =
    collapsibleAccounts.size > 0 &&
    [...collapsibleAccounts].every((account) => $collapsed.has(account));
  $: currencies = $operatingCurrency;
  $: gridTemplate = `${accountColumn} ${weightMeterColumn} ${weightColumn} ${
    currencies.length ? `repeat(${currencies.length}, minmax(8rem, 1fr))` : ""
  } minmax(11rem, 1fr)`;
  $: primaryCurrency =
    currencies[0] ??
    Object.keys(tree.balanceChildren).find((currency) => currency.length > 0) ??
    "";
  $: total = roots.reduce(
    (sum, root) =>
      sum +
      (root.balanceChildren[primaryCurrency] ?? 0) *
        multiplier *
        ($invertAccount(root.account) ? -1 : 1),
    0,
  );
  $: weightTotal = roots.reduce(
    (sum, root) =>
      sum +
      directWeightTotal(
        root,
        primaryCurrency,
        multiplier,
        $invertAccount(root.account) ? -1 : 1,
      ),
    0,
  );
  $: contributionNodes = roots.flatMap((root) =>
    root.children.length ? root.children : [root],
  );
  $: contributionTotal = contributionNodes.reduce(
    (sum, node) =>
      sum +
      Math.abs(
        (node.balanceChildren[primaryCurrency] ?? 0) *
          multiplier *
          ($invertAccount(node.account) ? -1 : 1),
      ),
    0,
  );
  $: contributions = contributionNodes
    .map((node) => {
      const amount =
        (node.balanceChildren[primaryCurrency] ?? 0) *
        multiplier *
        ($invertAccount(node.account) ? -1 : 1);
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

  function directWeightTotal(
    node: AccountTreeNode,
    currency: string,
    scale: number,
    invert: number,
  ): number {
    return (
      Math.abs((node.balance[currency] ?? 0) * scale * invert) +
      node.children.reduce(
        (sum: number, child: AccountTreeNode) =>
          sum + directWeightTotal(child, currency, scale, invert),
        0,
      )
    );
  }

  function toggle(account: string) {
    collapsed.update((current) => {
      const next = new Set(current);
      if (next.has(account)) next.delete(account);
      else next.add(account);
      return next;
    });
  }

  function toggleAll() {
    collapsed.set(allCollapsed ? new Set() : new Set(collapsibleAccounts));
  }
</script>

<section class="w-full min-w-0" data-statement-summary>
  <div class="flex items-baseline justify-between gap-4">
    <h2 class="text-lg font-semibold tracking-tight text-foreground">
      {title}
      <span class="font-mono text-base font-medium text-muted-foreground"
        >· {total && primaryCurrency
          ? $ctx.amount(total, primaryCurrency)
          : "—"}</span
      >
    </h2>
    {#if href}
      <a class="text-xs font-medium text-primary hover:underline" {href}
        >View account</a
      >
    {/if}
  </div>
  <div
    class="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
    role="img"
    aria-label={`${title} category contributions`}
    data-statement-contribution-bar
  >
    {#each contributions as contribution (contribution.account)}
      <span
        class="h-full first:rounded-l-full last:rounded-r-full"
        style={`width: ${contribution.percentage}%; background: ${contribution.color}`}
        title={`${contribution.account}: ${primaryCurrency ? $ctx.amount(contribution.amount, primaryCurrency) : "—"}`}
      ></span>
    {/each}
  </div>
  {#if contributions.length}
    <div
      class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"
    >
      {#each contributions as contribution (contribution.account)}
        <span class="flex min-w-0 items-center gap-2">
          <span
            class="size-2.5 shrink-0 rounded-full"
            style={`background: ${contribution.color}`}
            aria-hidden="true"
          ></span>
          <span class="truncate">{contribution.account}</span>
          <span class="font-mono text-xs tabular-nums text-foreground"
            >{contribution.percentage.toFixed(1)}%</span
          >
          {#if primaryCurrency}
            <span class="font-mono text-xs tabular-nums text-foreground"
              >{$ctx.amount(contribution.amount, primaryCurrency)}</span
            >
          {/if}
        </span>
      {/each}
    </div>
  {/if}
  <ScrollArea.Root
    orientation="horizontal"
    class="mt-4 w-full min-w-0 max-w-full rounded-xl"
  >
    <ol
      class="min-w-[45rem] overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm"
      data-statement-summary-tree-table
    >
      <li
        class="grid min-h-10 items-center bg-muted/65 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        style={`grid-template-columns: ${gridTemplate}`}
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
            onclick={toggleAll}
          >
            <ChevronsUpDown class="size-3" />
          </button>
          Account
        </span>
        <span aria-hidden="true"></span>
        <span class="px-4 py-2 text-right">Weight</span>
        {#each currencies as currency}
          <span class="px-4 py-2 text-right" title={$currencyName(currency)}
            >{currency}</span
          >
        {/each}
        <span class="px-4 py-2 text-right">Other</span>
      </li>
      {#each roots as root (root.account)}
        <StatementSummaryTreeRow
          node={root}
          {currencies}
          {primaryCurrency}
          {weightTotal}
          {multiplier}
          invert={$invertAccount(root.account) ? -1 : 1}
          collapsed={$collapsed}
          hiddenAccounts={$hiddenAccounts}
          {toggle}
          currencyName={$currencyName}
          branchColor={dashboardCategoryColor(root.account)}
          {gridTemplate}
        />
      {/each}
    </ol>
  </ScrollArea.Root>
</section>
