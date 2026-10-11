<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import type { AccountTreeNode } from "../../lib/models";
  import { urlForAccount } from "../../helpers";
  import Self from "./DashboardTreeRow.svelte";
  import { dashboardCategoryColor } from "./model";

  export let node: AccountTreeNode;
  export let currency: string;
  export let formatter: (value: number, currency: string) => string;
  export let multiplier = 1;
  export let total = 0;
  export let depth = 0;
  export let collapsed: Set<string>;
  export let toggle: (account: string) => void;
  export let branchColor = "var(--primary)";

  const weightBars = [0, 1, 2, 3, 4];

  $: hasChildren = node.children.length > 0;
  $: isCollapsed = collapsed.has(node.account);
  $: amount = (node.balanceChildren[currency] ?? 0) * multiplier;
  $: name = node.account.split(":").at(-1) ?? node.account;
  $: weight = total ? (Math.abs(amount) / Math.abs(total)) * 100 : 0;
</script>

<li>
  <div
    class="grid min-h-12 grid-cols-[minmax(0,1fr)_8rem_10rem] items-center border-t border-border/70 text-sm transition-colors hover:bg-muted/65"
    data-dashboard-tree-row
  >
    <div
      class="flex min-w-0 items-center gap-1 py-2 pr-4"
      style={`padding-left: ${0.9 + depth * 1.2}rem`}
    >
      {#if hasChildren}
        <button
          class="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.account}`}
          aria-expanded={!isCollapsed}
          on:click={() => toggle(node.account)}
        >
          <ChevronDown
            class={`size-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
          />
        </button>
      {:else}
        <span class="size-4 shrink-0" aria-hidden="true"></span>
      {/if}
      <a
        class="truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
        href={urlForAccount(node.account)}
        title={node.account}>{name}</a
      >
    </div>
    <span
      class:dimmed={!amount}
      class="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2 px-4 text-right font-mono text-[13px] tabular-nums"
    >
      <span
        class:invisible={!amount}
        class="weight-meter justify-self-start"
        style={`--meter-color: ${branchColor}`}
        data-dashboard-weight-meter
        aria-hidden="true"
      >
        {#each weightBars as bar}
          <span style={`opacity: ${0.48 + bar * 0.11}`}></span>
        {/each}
      </span>
      <span class="justify-self-end"
        >{amount ? `${weight.toFixed(1)}%` : "—"}</span
      >
    </span>
    <span
      class:dimmed={!amount}
      class="px-4 text-right font-mono text-[13px] tabular-nums"
    >
      {amount ? formatter(amount, currency) : "—"}
    </span>
  </div>
  {#if hasChildren && !isCollapsed}
    <ol>
      {#each node.children as child (child.account)}
        <Self
          node={child}
          {currency}
          {formatter}
          {multiplier}
          {total}
          depth={depth + 1}
          branchColor={depth === 0
            ? dashboardCategoryColor(child.account)
            : branchColor}
          {collapsed}
          {toggle}
        />
      {/each}
    </ol>
  {/if}
</li>

<style>
  .dimmed {
    color: var(--muted-foreground);
  }

  .weight-meter {
    display: grid;
    grid-template-columns: repeat(5, 0.22rem);
    gap: 0.14rem;
    height: 0.85rem;
    align-items: stretch;
    color: var(--meter-color);
  }

  .weight-meter > span {
    border-radius: 999px;
    background: currentColor;
  }
</style>
