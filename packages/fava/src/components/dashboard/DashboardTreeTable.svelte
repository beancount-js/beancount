<script lang="ts">
  import type { AccountTreeNode } from "../../lib/models";
  import DashboardTreeRow from "./DashboardTreeRow.svelte";

  export let tree: AccountTreeNode;
  export let title: string;
  export let href: string;
  export let currency: string;
  export let formatter: (value: number, currency: string) => string;
  export let multiplier = 1;

  let collapsed = new Set<string>();

  $: roots = tree.account === "" ? tree.children : [tree];
  $: total = roots.reduce(
    (sum, root) => sum + (root.balanceChildren[currency] ?? 0) * multiplier,
    0,
  );

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
    class="mt-3 h-2 w-full rounded-full bg-primary/80"
    aria-hidden="true"
  ></div>
  <div class="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
    <span class="size-2.5 rounded-full bg-primary" aria-hidden="true"></span>
    <span>{title}</span>
    <span class="font-mono text-xs tabular-nums text-foreground"
      >{total ? "100%" : "—"}</span
    >
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
