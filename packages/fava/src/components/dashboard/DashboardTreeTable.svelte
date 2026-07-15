<script lang="ts">
  import type { AccountTreeNode } from "../../lib/models";
  import DashboardTreeRow from "./DashboardTreeRow.svelte";

  export let tree: AccountTreeNode;
  export let title: string;
  export let href: string;
  export let currency: string;
  export let formatter: (value: number, currency: string) => string;
  export let multiplier = 1;

  const contributionColors = [
    "#7667d9",
    "#3c8ce7",
    "#36a981",
    "#dd8b45",
    "#d96478",
    "#8491b6",
  ];

  let collapsed = new Set<string>();

  $: roots = tree.account === "" ? tree.children : [tree];
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
    .map((node, index) => {
      const amount = (node.balanceChildren[currency] ?? 0) * multiplier;
      return {
        account: node.account,
        amount,
        color: contributionColors[index % contributionColors.length],
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
</script>

<section class="w-full" data-dashboard-tree-table>
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
    class="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted"
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
  <div
    class="mt-4 overflow-x-auto rounded-2xl border border-border/80 bg-card p-1"
  >
    <ol
      class="min-w-[38rem] overflow-hidden rounded-xl"
      data-dashboard-tree-rows
    >
      <li
        class="grid grid-cols-[minmax(0,1fr)_6rem_9rem] items-center bg-muted/65 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
      >
        <span class="px-3 py-2">Account</span>
        <span class="px-3 py-2 text-right">Weight</span>
        <span class="px-3 py-2 text-right">Value</span>
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
        />
      {/each}
    </ol>
  </div>
</section>
