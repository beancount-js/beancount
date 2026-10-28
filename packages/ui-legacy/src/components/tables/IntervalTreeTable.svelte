<script lang="ts">
  import type { Snippet } from "svelte";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import * as Table from "../shadcn/table";

  export type IntervalTreeColumn = {
    id: string;
    label: string;
    title?: string;
    href?: string;
  };

  export type IntervalTreeAmount = {
    value: string;
    title?: string;
    difference?: {
      value: string;
      title?: string;
      tone: "positive" | "negative";
    };
  };

  export type IntervalTreeCell = {
    values: readonly IntervalTreeAmount[];
    /** Values to show when this row's descendants are collapsed into it. */
    collapsedValues?: readonly IntervalTreeAmount[];
    dimmed?: boolean;
    /** Dimmed state to use alongside `collapsedValues`. */
    collapsedDimmed?: boolean;
  };

  export type IntervalTreeNode = {
    id: string;
    label: string;
    cells: Readonly<Record<string, IntervalTreeCell | undefined>>;
    href?: string;
    children?: readonly IntervalTreeNode[];
  };

  type VisibleNode = {
    node: IntervalTreeNode;
    depth: number;
    hasChildren: boolean;
  };

  let {
    nodes,
    columns,
    ariaLabel = "Account interval comparison",
    initialCollapsedIds = new Set<string>(),
    onNavigate,
    onColumnNavigate,
    accountCell,
  }: {
    nodes: readonly IntervalTreeNode[];
    columns: readonly IntervalTreeColumn[];
    ariaLabel?: string;
    /** Account ids initially collapsed from an application's persisted preferences. */
    initialCollapsedIds?: ReadonlySet<string>;
    onNavigate?: (node: IntervalTreeNode) => void;
    onColumnNavigate?: (column: IntervalTreeColumn) => void;
    /**
     * Optional application-specific account renderer. When supplied, it owns
     * account navigation and can add contextual content such as an avatar.
     */
    accountCell?: Snippet<[IntervalTreeNode]>;
  } = $props();

  let collapsedIds = $state<Set<string>>(new Set());
  let hasAppliedInitialCollapsedIds = false;

  $effect.pre(() => {
    if (hasAppliedInitialCollapsedIds) return;
    collapsedIds = new Set(initialCollapsedIds);
    hasAppliedInitialCollapsedIds = true;
  });

  const collapsibleIds = $derived(collectCollapsibleIds(nodes));
  const allCollapsed = $derived(
    collapsibleIds.length > 0 &&
      collapsibleIds.every((id) => collapsedIds.has(id)),
  );
  const visibleNodes = $derived(flatten(nodes, collapsedIds));

  function collectCollapsibleIds(
    entries: readonly IntervalTreeNode[],
  ): string[] {
    return entries.flatMap((entry) => {
      const children = entry.children ?? [];
      return children.length
        ? [entry.id, ...collectCollapsibleIds(children)]
        : [];
    });
  }

  function flatten(
    entries: readonly IntervalTreeNode[],
    collapsed: ReadonlySet<string>,
    depth = 0,
  ): VisibleNode[] {
    return entries.flatMap((entry) => {
      const children = entry.children ?? [];
      const hasChildren = children.length > 0;
      const row = { node: entry, depth, hasChildren };
      return hasChildren && !collapsed.has(entry.id)
        ? [row, ...flatten(children, collapsed, depth + 1)]
        : [row];
    });
  }

  function toggle(id: string) {
    const next = new Set(collapsedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsedIds = next;
  }

  function toggleAll() {
    collapsedIds = allCollapsed ? new Set() : new Set(collapsibleIds);
  }

  function navigate(node: IntervalTreeNode, event: MouseEvent) {
    if (onNavigate) event.preventDefault();
    onNavigate?.(node);
  }

  function navigateColumn(column: IntervalTreeColumn, event: MouseEvent) {
    if (onColumnNavigate) event.preventDefault();
    onColumnNavigate?.(column);
  }
</script>

<div data-interval-tree-table class="cn-tables-intervaltreetable-137-1">
  <Table.Root aria-label={ariaLabel} class="cn-tables-intervaltreetable-139-1">
    <Table.Header>
      <Table.Row class="cn-tables-intervaltreetable-141-1">
        <Table.Head class="cn-tables-intervaltreetable-143-1">
          <span class="cn-tables-intervaltreetable-145-1">
            {#if collapsibleIds.length}
              <button
                type="button"
                class="cn-tables-intervaltreetable-149-1"
                aria-label={allCollapsed
                  ? "Expand all accounts"
                  : "Collapse all accounts"}
                aria-pressed={allCollapsed}
                onclick={toggleAll}
              >
                <ChevronsUpDown
                  class="cn-tables-intervaltreetable-156-1"
                  aria-hidden="true"
                />
              </button>
            {/if}
            Account
          </span>
        </Table.Head>
        {#each columns as column (column.id)}
          <Table.Head
            class="cn-tables-intervaltreetable-164-1"
            title={column.title}
          >
            {#if column.href}
              <a
                href={column.href}
                class="cn-tables-intervaltreetable-170-1"
                onclick={(event) => navigateColumn(column, event)}
              >
                {column.label}
              </a>
            {:else}
              {column.label}
            {/if}
          </Table.Head>
        {/each}
      </Table.Row>
    </Table.Header>
    <Table.Body>
      {#each visibleNodes as { node, depth, hasChildren } (node.id)}
        {@const isCollapsed = collapsedIds.has(node.id)}
        <Table.Row>
          <Table.Cell class="cn-tables-intervaltreetable-186-1">
            <div
              class="cn-tables-intervaltreetable-188-1"
              style={`padding-left: ${depth * 1.25}rem`}
            >
              {#if hasChildren}
                <button
                  type="button"
                  class="cn-tables-intervaltreetable-194-1"
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.label}`}
                  aria-expanded={!isCollapsed}
                  onclick={() => toggle(node.id)}
                >
                  {#if isCollapsed}
                    <ChevronRight
                      class="cn-tables-intervaltreetable-200-1"
                      aria-hidden="true"
                    />
                  {:else}
                    <ChevronDown
                      class="cn-tables-intervaltreetable-202-1"
                      aria-hidden="true"
                    />
                  {/if}
                </button>
              {:else}
                <span
                  class="cn-tables-intervaltreetable-206-1"
                  aria-hidden="true"
                ></span>
              {/if}
              {#if accountCell}
                {@render accountCell(node)}
              {:else if node.href}
                <a
                  href={node.href}
                  class="cn-tables-intervaltreetable-213-1"
                  onclick={(event) => navigate(node, event)}
                >
                  {node.label}
                </a>
              {:else}
                <span class="cn-tables-intervaltreetable-219-1"
                  >{node.label}</span
                >
              {/if}
            </div>
          </Table.Cell>
          {#each columns as column (column.id)}
            {@const cell = node.cells[column.id]}
            {@const displayedCell =
              isCollapsed && cell?.collapsedValues !== undefined
                ? {
                    values: cell.collapsedValues,
                    dimmed: cell.collapsedDimmed ?? cell.dimmed,
                  }
                : cell}
            <Table.Cell
              class={`cn-tables-intervaltreetable-233-3 cn-tables-intervaltreetable-233-4 cn-tables-intervaltreetable-233-5 cn-tables-intervaltreetable-233-2 cn-tables-intervaltreetable-233-6 tabular-nums ${displayedCell?.dimmed ? "cn-tables-intervaltreetable-233-1" : ""}`}
            >
              {#each displayedCell?.values ?? [] as amount, index (index)}
                <span
                  class="cn-tables-intervaltreetable-236-1"
                  title={amount.title}
                >
                  {amount.value}
                  {#if amount.difference}
                    <span
                      class={`cn-tables-intervaltreetable-240-4 cn-tables-intervaltreetable-240-5 ${amount.difference.tone === "positive" ? "cn-tables-intervaltreetable-240-3 cn-tables-intervaltreetable-240-1" : "cn-tables-intervaltreetable-240-2"}`}
                      title={amount.difference.title}
                    >
                      {amount.difference.value}
                    </span>
                  {/if}
                </span>
              {:else}
                <span class="cn-tables-intervaltreetable-248-1">—</span>
              {/each}
            </Table.Cell>
          {/each}
        </Table.Row>
      {/each}
    </Table.Body>
  </Table.Root>
</div>
