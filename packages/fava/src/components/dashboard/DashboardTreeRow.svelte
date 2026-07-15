<script lang="ts">
  import { ChevronDown } from "lucide-svelte";
  import type { AccountTreeNode } from "../../lib/models";
  import { urlForAccount } from "../../helpers";
  import Self from "./DashboardTreeRow.svelte";

  export let node: AccountTreeNode;
  export let currency: string;
  export let formatter: (value: number, currency: string) => string;
  export let multiplier = 1;
  export let total = 0;
  export let depth = 0;
  export let collapsed: Set<string>;
  export let toggle: (account: string) => void;

  $: hasChildren = node.children.length > 0;
  $: isCollapsed = collapsed.has(node.account);
  $: amount = (node.balanceChildren[currency] ?? 0) * multiplier;
  $: name = node.account.split(":").at(-1) ?? node.account;
  $: weight = total ? (Math.abs(amount) / Math.abs(total)) * 100 : 0;
</script>

<li>
  <div
    class="grid min-h-10 grid-cols-[minmax(0,1fr)_6rem_9rem] items-center border-b border-border/70 text-sm"
  >
    <div
      class="flex min-w-0 items-center gap-1 py-1.5 pr-3"
      style={`padding-left: ${0.7 + depth * 1.15}rem`}
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
        class="truncate font-mono text-[13px] text-foreground hover:text-primary hover:underline"
        href={urlForAccount(node.account)}
        title={node.account}>{name}</a
      >
    </div>
    <span
      class:dimmed={!amount}
      class="flex items-center justify-end gap-1.5 px-3 text-right font-mono text-[13px] tabular-nums"
    >
      <span
        class:invisible={!amount}
        class="text-[10px] tracking-[-0.16em] text-primary"
        aria-hidden="true">▍▍▍▍▍</span
      >
      <span>{amount ? `${weight.toFixed(1)}%` : "—"}</span>
    </span>
    <span
      class:dimmed={!amount}
      class="px-3 text-right font-mono text-[13px] tabular-nums"
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
          {collapsed}
          {toggle}
        />
      {/each}
    </ol>
  {/if}
</li>

<style>
  .dimmed {
    color: hsl(var(--muted-foreground));
  }
</style>
