<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import type { StatementSummaryTreeNode } from "./StatementSummaryTreeTable.svelte";
  import Self from "./StatementSummaryTreeRow.svelte";

  let {
    node,
    columns,
    collapsedIds,
    onToggle,
    onNavigate,
    depth = 0,
  }: {
    node: StatementSummaryTreeNode;
    columns: readonly { id: string; label: string; title?: string }[];
    collapsedIds: ReadonlySet<string>;
    onToggle: (id: string) => void;
    onNavigate?: (node: StatementSummaryTreeNode) => void;
    depth?: number;
  } = $props();

  const { values: directValues, otherValues: directOtherValues, collapsedValues: directCollapsedValues, collapsedOtherValues: directCollapsedOtherValues, collapsedWeight: directCollapsedWeight } = node;
  const weightBars = [0, 1, 2, 3, 4];

  let hasChildren = $derived(node.children?.length > 0);
  let isCollapsed = $derived(collapsedIds.has(node.id));
  let shownValues = $derived(
    isCollapsed && directCollapsedValues !== undefined ? directCollapsedValues : directValues,
  );
  let shownOtherValues = $derived(
    isCollapsed && directCollapsedOtherValues !== undefined
      ? directCollapsedOtherValues
      : directOtherValues,
  );
  let shownWeight = $derived(
    isCollapsed && directCollapsedWeight !== undefined ? directCollapsedWeight : node.weight,
  );
  let hasWeight = $derived(
    typeof shownWeight === "string" &&
      shownWeight !== "" &&
      !Number.isNaN(Number.parseFloat(shownWeight)),
  );
  let displayWeight = $derived(shownWeight || "—");

  function navigate(event: MouseEvent) {
    if (onNavigate) event.preventDefault();
    onNavigate?.(node);
  }
</script>

<li>
  <div
    class="grid min-h-12 items-center border-t border-border/70 text-sm transition-colors hover:bg-muted/65"
    data-statement-summary-tree-row
  >
    <div
      class="flex min-w-0 items-center gap-1 py-2 pr-4"
      style={`padding-left: ${0.9 + depth * 1.2}rem`}
    >
      {#if hasChildren}
        <button
          type="button"
          class="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.label}`}
          aria-expanded={!isCollapsed}
          onclick={() => onToggle(node.id)}
        >
          <ChevronDown
            class={`size-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
          />
        </button>
      {:else}
        <span class="size-4 shrink-0" aria-hidden="true"></span>
      {/if}
      {#if node.href}
        <a
          href={node.href}
          class="min-w-0 truncate text-primary hover:underline"
          onclick={navigate}
        >
          {node.label}
        </a>
      {:else}
        <span class="min-w-0 truncate">{node.label}</span>
      {/if}
    </div>
    <span
      class="grid place-items-center py-2 pl-4 pr-2"
      data-statement-weight-meter-column
    >
      <span
        class:invisible={!hasWeight}
        class="weight-meter"
        data-statement-weight-meter
        aria-hidden="true"
      >
        {#each weightBars as bar}
          <span style={`opacity: ${0.48 + bar * 0.11}`}></span>
        {/each}
      </span>
    </span>
    <span
      class:bj-statement-summary-muted={!hasWeight}
      class="px-4 text-right font-mono text-[13px] tabular-nums"
      data-statement-weight
      >{displayWeight}</span
    >
    {#each columns as column (column.id)}
      {@const value = shownValues[column.id] ?? "—"}
      <span
        class:bj-statement-summary-muted={value === "—"}
        class="px-4 text-right font-mono text-[13px] tabular-nums"
      >
        {value}
      </span>
    {/each}
    <span class="px-4 py-2 text-right font-mono text-[13px] tabular-nums" class:bj-statement-summary-muted={shownOtherValues?.length === 0}>
      {#each shownOtherValues ?? [] as value (value.label)}
        <span class="block" title={value.title}>{value.value}</span>
      {/each}
      {#if (shownOtherValues?.length ?? 0) === 0}
        <span class="text-muted-foreground">—</span>
      {/if}
    </span>
  </div>
  {#if hasChildren && !isCollapsed}
    <ol>
      {#each node.children as child (child.id)}
        <Self
          {columns}
          {collapsedIds}
          {onToggle}
          {onNavigate}
          node={child}
          depth={depth + 1}
        />
      {/each}
    </ol>
  {/if}
</li>

<style>
  .dimmed,
  .bj-statement-summary-muted {
    color: var(--muted-foreground);
  }

  .weight-meter {
    display: grid;
    grid-template-columns: repeat(5, 0.22rem);
    gap: 0.14rem;
    height: 0.85rem;
    align-items: stretch;
    justify-self: center;
  }

  .weight-meter > span {
    border-radius: 999px;
    background: currentColor;
  }
</style>
