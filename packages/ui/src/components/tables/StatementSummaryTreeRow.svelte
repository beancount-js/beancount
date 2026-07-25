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

  let directValues = $derived(node.values);
  let directOtherValues = $derived(node.otherValues);
  let directCollapsedValues = $derived(node.collapsedValues);
  let directCollapsedOtherValues = $derived(node.collapsedOtherValues);
  let directCollapsedWeight = $derived(node.collapsedWeight);
  const weightBars = [0, 1, 2, 3, 4];

  let hasChildren = $derived(node.children?.length > 0);
  let isCollapsed = $derived(collapsedIds.has(node.id));
  let shownValues = $derived(
    isCollapsed && directCollapsedValues !== undefined
      ? directCollapsedValues
      : directValues,
  );
  let shownOtherValues = $derived(
    isCollapsed && directCollapsedOtherValues !== undefined
      ? directCollapsedOtherValues
      : directOtherValues,
  );
  let shownWeight = $derived(
    isCollapsed && directCollapsedWeight !== undefined
      ? directCollapsedWeight
      : node.weight,
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
    class="cn-tables-statementsummarytreerow-53-1"
    data-statement-summary-tree-row
  >
    <div
      class="cn-tables-statementsummarytreerow-57-1"
      style={`padding-left: ${0.9 + depth * 1.2}rem`}
    >
      {#if hasChildren}
        <button
          type="button"
          class="cn-tables-statementsummarytreerow-63-1"
          aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.label}`}
          aria-expanded={!isCollapsed}
          onclick={() => onToggle(node.id)}
        >
          <ChevronDown
            class={`cn-tables-statementsummarytreerow-69-2 cn-tables-statementsummarytreerow-69-3 ${isCollapsed ? "cn-tables-statementsummarytreerow-69-1" : ""}`}
          />
        </button>
      {:else}
        <span class="cn-tables-statementsummarytreerow-73-1" aria-hidden="true"
        ></span>
      {/if}
      {#if node.href}
        <a
          href={node.href}
          class="cn-tables-statementsummarytreerow-78-1"
          onclick={navigate}
        >
          {node.label}
        </a>
      {:else}
        <span class="cn-tables-statementsummarytreerow-84-1">{node.label}</span>
      {/if}
    </div>
    <span
      class="cn-tables-statementsummarytreerow-88-1"
      data-statement-weight-meter-column
    >
      <span
        class:cn-tables-statementsummarytreerow-92-1={!hasWeight}
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
      class="cn-tables-statementsummarytreerow-104-1"
      data-statement-weight>{displayWeight}</span
    >
    {#each columns as column (column.id)}
      {@const value = shownValues[column.id] ?? "—"}
      <span
        class:bj-statement-summary-muted={value === "—"}
        class="cn-tables-statementsummarytreerow-112-1"
      >
        {value}
      </span>
    {/each}
    <span
      class="cn-tables-statementsummarytreerow-117-1"
      class:bj-statement-summary-muted={shownOtherValues?.length === 0}
    >
      {#each shownOtherValues ?? [] as value (value.label)}
        <span
          class="cn-tables-statementsummarytreerow-119-1"
          title={value.title}>{value.value}</span
        >
      {/each}
      {#if (shownOtherValues?.length ?? 0) === 0}
        <span class="cn-tables-statementsummarytreerow-122-1">—</span>
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
