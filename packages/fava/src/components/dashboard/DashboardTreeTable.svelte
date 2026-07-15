<script lang="ts">
  import type { AccountTreeNode } from "../../lib/models";
  import DashboardTreeRow from "./DashboardTreeRow.svelte";

  export let tree: AccountTreeNode;
  export let currency: string;
  export let formatter: (value: number, currency: string) => string;
  export let multiplier = 1;
  export let label = "Balance";

  let collapsed = new Set<string>();

  $: roots = tree.account === "" ? tree.children : [tree];

  function toggle(account: string) {
    const next = new Set(collapsed);
    if (next.has(account)) next.delete(account);
    else next.add(account);
    collapsed = next;
  }
</script>

<div class="overflow-x-auto">
  <ol class="min-w-[30rem] border-y border-border/80" data-dashboard-tree-table>
    <li
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center bg-muted/65 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
    >
      <span class="px-3 py-2">Account</span>
      <span class="px-3 py-2 font-mono normal-case tracking-normal"
        >{label} ({currency})</span
      >
    </li>
    {#each roots as root (root.account)}
      <DashboardTreeRow
        node={root}
        {currency}
        {formatter}
        {multiplier}
        {collapsed}
        {toggle}
      />
    {/each}
  </ol>
</div>
