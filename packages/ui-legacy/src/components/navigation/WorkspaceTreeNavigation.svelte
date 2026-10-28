<script lang="ts">
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import FileText from "lucide-svelte/icons/file-text";
  import type { Icon } from "lucide-svelte";
  import { Button } from "../shadcn/button";
  import { cn } from "../../lib/utils";

  export type WorkspaceTreeNavigationItem = {
    /** Stable application-owned identifier for selection and expansion state. */
    id: string;
    label: string;
    /** A compact count or status displayed at the row end. */
    badge?: string;
    icon?: typeof Icon;
    /** Opt into the compact ledger-sidebar row treatment. */
    kind?: "ledger-file" | "ledger-panel" | "ledger-folder" | "ledger-tag";
    /** Allows an application to mark a parent and a nested destination active. */
    active?: boolean;
    disabled?: boolean;
    children?: readonly WorkspaceTreeNavigationItem[];
  };

  /**
   * Router-independent, controlled tree navigation for a workspace sidebar.
   * Applications map domain folders, ledgers, tags, or nested pages into this
   * display model and retain routing, filtering, and persistence themselves.
   */
  let {
    items,
    activeId,
    expandedIds = [],
    ariaLabel = "Workspace navigation",
    emptyLabel = "No navigation items are available.",
    showExpandAll = true,
    variant = "default",
    onSelect,
    onExpandedIdsChange,
  }: {
    items: readonly WorkspaceTreeNavigationItem[];
    activeId?: string;
    expandedIds?: readonly string[];
    ariaLabel?: string;
    emptyLabel?: string;
    showExpandAll?: boolean;
    variant?: "default" | "ledger";
    onSelect?: (id: string) => void;
    onExpandedIdsChange?: (ids: string[]) => void;
  } = $props();

  function childRegionId(id: string): string {
    return `workspace-tree-children-${id.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  function expandableItemIds(
    tree: readonly WorkspaceTreeNavigationItem[],
  ): string[] {
    return tree.flatMap((item) => [
      ...(item.children?.length ? [item.id] : []),
      ...expandableItemIds(item.children ?? []),
    ]);
  }

  function isExpanded(item: WorkspaceTreeNavigationItem): boolean {
    return expandedIds.includes(item.id);
  }

  function updateExpansion(id: string): void {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onExpandedIdsChange?.([...next]);
  }

  function toggleAll(): void {
    const expandable = expandableItemIds(items);
    const hasCollapsedItem = expandable.some((id) => !expandedIds.includes(id));
    onExpandedIdsChange?.(hasCollapsedItem ? expandable : []);
  }

  function itemIndentStyle(depth: number): string {
    return `padding-left: ${depth * 20}px;`;
  }

  function ledgerFileRowStyle(depth: number): string {
    return `padding-left: ${0.25 + Math.max(depth, 0) * 0.875}rem`;
  }

  function ledgerPanelStyle(depth: number): string {
    return `padding-left: ${2 + Math.max(depth, 0) * 0.875}rem`;
  }

  function ledgerGuideStyle(depth: number): string {
    return `left: ${0.75 + depth * 0.875}rem`;
  }

  function isActive(item: WorkspaceTreeNavigationItem): boolean {
    return item.active ?? item.id === activeId;
  }
</script>

<nav
  class={variant === "ledger"
    ? "cn-navigation-workspacetreenavigation-105-1"
    : "cn-navigation-workspacetreenavigation-106-1"}
  aria-label={ariaLabel}
>
  {#if showExpandAll && expandableItemIds(items).length}
    {@const expandable = expandableItemIds(items)}
    {@const hasCollapsedItem = expandable.some(
      (id) => !expandedIds.includes(id),
    )}
    <div class="cn-navigation-workspacetreenavigation-114-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="cn-navigation-workspacetreenavigation-119-1"
        aria-label={hasCollapsedItem
          ? "Expand all navigation items"
          : "Collapse all navigation items"}
        title={hasCollapsedItem
          ? "Expand all navigation items"
          : "Collapse all navigation items"}
        disabled={!onExpandedIdsChange}
        onclick={toggleAll}
      >
        {#if hasCollapsedItem}
          <ChevronsUpDown aria-hidden="true" />
        {:else}
          <ChevronsDownUp aria-hidden="true" />
        {/if}
      </Button>
    </div>
  {/if}

  {#each items as item (item.id)}
    {#if variant === "ledger"}
      {@render LedgerTreeItem({ item, depth: 0 })}
    {:else}
      {@render TreeItem({ item, depth: 0 })}
    {/if}
  {:else}
    <p class="cn-navigation-workspacetreenavigation-145-1">{emptyLabel}</p>
  {/each}
</nav>

{#snippet TreeItem({
  item,
  depth,
}: {
  item: WorkspaceTreeNavigationItem;
  depth: number;
})}
  {@const expanded = isExpanded(item)}
  {@const hasChildren = Boolean(item.children?.length)}
  {@const selected = isActive(item)}
  {@const Icon = item.icon ?? FileText}
  <div
    class="cn-navigation-workspacetreenavigation-160-1"
    data-workspace-tree-item={item.id}
  >
    <div
      class={cn(
        "cn-navigation-workspacetreenavigation-163-1",
        selected
          ? "cn-navigation-workspacetreenavigation-165-1"
          : "cn-navigation-workspacetreenavigation-166-1",
      )}
      style={itemIndentStyle(depth)}
    >
      {#each Array(depth) as _, guideDepth (guideDepth)}
        <span
          aria-hidden="true"
          class="cn-navigation-workspacetreenavigation-173-1"
          style={`left: calc(0.75rem + ${guideDepth * 1.25}rem);`}
        ></span>
      {/each}

      {#if hasChildren}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          class="cn-navigation-workspacetreenavigation-183-1"
          aria-label={expanded
            ? `Collapse ${item.label}`
            : `Expand ${item.label}`}
          aria-controls={childRegionId(item.id)}
          aria-expanded={expanded}
          disabled={item.disabled || !onExpandedIdsChange}
          onclick={() => updateExpansion(item.id)}
        >
          <ChevronRight
            aria-hidden="true"
            class={cn(
              "cn-navigation-workspacetreenavigation-194-1",
              expanded && "cn-navigation-workspacetreenavigation-194-2",
            )}
          />
        </Button>
      {:else}
        <span
          class="cn-navigation-workspacetreenavigation-198-1"
          aria-hidden="true"
        ></span>
      {/if}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="cn-navigation-workspacetreenavigation-205-1"
        aria-current={selected ? "page" : undefined}
        disabled={item.disabled || !onSelect}
        title={item.label}
        onclick={() => onSelect?.(item.id)}
      >
        <Icon
          class="cn-navigation-workspacetreenavigation-211-1"
          aria-hidden="true"
        />
        <span class="cn-navigation-workspacetreenavigation-212-1"
          >{item.label}</span
        >
        {#if item.badge}
          <span class="cn-navigation-workspacetreenavigation-214-1">
            {item.badge}
          </span>
        {/if}
      </Button>
    </div>

    {#if hasChildren && expanded}
      <div
        id={childRegionId(item.id)}
        class="cn-navigation-workspacetreenavigation-222-1"
      >
        {#each item.children ?? [] as child (child.id)}
          {@render TreeItem({ item: child, depth: depth + 1 })}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}

{#snippet LedgerTreeItem({
  item,
  depth,
}: {
  item: WorkspaceTreeNavigationItem;
  depth: number;
})}
  {@const expanded = isExpanded(item)}
  {@const hasChildren = Boolean(item.children?.length)}
  {@const active = isActive(item)}
  {@const Icon = item.icon ?? FileText}
  {#if item.kind === "ledger-panel"}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      class={cn(
        "cn-navigation-workspacetreenavigation-248-1",
        active
          ? "cn-navigation-workspacetreenavigation-250-1"
          : "cn-navigation-workspacetreenavigation-251-1",
      )}
      style={ledgerPanelStyle(depth - 1)}
      aria-current={active ? "page" : undefined}
      disabled={item.disabled || !onSelect}
      onclick={() => onSelect?.(item.id)}
    >
      {#each Array(Math.max(depth, 0)) as _, guideDepth (guideDepth)}
        <span
          aria-hidden="true"
          class="cn-navigation-workspacetreenavigation-261-1"
          style={ledgerGuideStyle(guideDepth)}
        ></span>
      {/each}
      <Icon
        class="cn-navigation-workspacetreenavigation-265-1"
        aria-hidden="true"
      />
      <span class="cn-navigation-workspacetreenavigation-266-1"
        >{item.label}</span
      >
    </Button>
  {:else if item.kind === "ledger-folder"}
    <div
      class="cn-navigation-workspacetreenavigation-269-1"
      data-workspace-tree-item={item.id}
    >
      <div
        class="cn-navigation-workspacetreenavigation-271-1"
        style={ledgerFileRowStyle(depth)}
      >
        {#each Array(Math.max(depth, 0)) as _, guideDepth (guideDepth)}
          <span
            aria-hidden="true"
            class="cn-navigation-workspacetreenavigation-277-1"
            style={ledgerGuideStyle(guideDepth)}
          ></span>
        {/each}

        {#if hasChildren}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="cn-navigation-workspacetreenavigation-287-1"
            aria-label={expanded
              ? `Collapse ${item.label}`
              : `Expand ${item.label}`}
            aria-controls={childRegionId(item.id)}
            aria-expanded={expanded}
            disabled={item.disabled || !onExpandedIdsChange}
            onclick={() => updateExpansion(item.id)}
          >
            <ChevronRight
              class={cn(
                "cn-navigation-workspacetreenavigation-297-1",
                expanded && "cn-navigation-workspacetreenavigation-297-2",
              )}
              aria-hidden="true"
            />
          </Button>
        {:else}
          <span
            class="cn-navigation-workspacetreenavigation-302-1"
            aria-hidden="true"
          ></span>
        {/if}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="cn-navigation-workspacetreenavigation-309-1"
          title={item.label}
          disabled={item.disabled || !onSelect}
          onclick={() => onSelect?.(item.id)}
        >
          <Icon
            class="cn-navigation-workspacetreenavigation-314-1"
            aria-hidden="true"
          />
          <span class="cn-navigation-workspacetreenavigation-315-1"
            >{item.label}</span
          >
          {#if item.badge}
            <span class="cn-navigation-workspacetreenavigation-317-1"
              >{item.badge}</span
            >
          {/if}
        </Button>
      </div>
      {#if hasChildren && expanded}
        <div
          id={childRegionId(item.id)}
          class="cn-navigation-workspacetreenavigation-324-1"
        >
          {#each item.children ?? [] as child (child.id)}
            {@render LedgerTreeItem({ item: child, depth: depth + 1 })}
          {/each}
        </div>
      {/if}
    </div>
  {:else if item.kind === "ledger-tag"}
    <div
      class="cn-navigation-workspacetreenavigation-332-1"
      data-workspace-tree-item={item.id}
    >
      <div
        class="cn-navigation-workspacetreenavigation-334-1"
        style={ledgerFileRowStyle(depth)}
      >
        {#each Array(Math.max(depth, 0)) as _, guideDepth (guideDepth)}
          <span
            aria-hidden="true"
            class="cn-navigation-workspacetreenavigation-340-1"
            style={ledgerGuideStyle(guideDepth)}
          ></span>
        {/each}
        {#if hasChildren}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            class="cn-navigation-workspacetreenavigation-349-1"
            aria-label={expanded
              ? `Collapse ${item.label}`
              : `Expand ${item.label}`}
            aria-expanded={expanded}
            disabled={item.disabled || !onExpandedIdsChange}
            onclick={() => updateExpansion(item.id)}
          >
            <ChevronRight
              class={cn(
                "cn-navigation-workspacetreenavigation-358-1",
                expanded && "cn-navigation-workspacetreenavigation-358-2",
              )}
              aria-hidden="true"
            />
          </Button>
        {/if}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="cn-navigation-workspacetreenavigation-367-1"
          title={item.label}
          aria-pressed={active}
          disabled={item.disabled || !onSelect}
          onclick={() => onSelect?.(item.id)}
        >
          <Icon
            class="cn-navigation-workspacetreenavigation-373-1"
            aria-hidden="true"
          />
          <span class="cn-navigation-workspacetreenavigation-374-1"
            >{item.label}</span
          >
          {#if item.badge}
            <span class="cn-navigation-workspacetreenavigation-376-1"
              >{item.badge}</span
            >
          {/if}
        </Button>
      </div>
      {#if hasChildren && expanded}
        <div class="cn-navigation-workspacetreenavigation-381-1">
          {#each item.children ?? [] as child (child.id)}
            {@render LedgerTreeItem({ item: child, depth: depth + 1 })}
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div
      class="cn-navigation-workspacetreenavigation-389-1"
      data-workspace-tree-item={item.id}
    >
      <div
        class={cn(
          "cn-navigation-workspacetreenavigation-392-1",
          active
            ? "cn-navigation-workspacetreenavigation-394-1"
            : "cn-navigation-workspacetreenavigation-395-1",
        )}
        style={ledgerFileRowStyle(depth)}
      >
        {#each Array(Math.max(depth, 0)) as _, guideDepth (guideDepth)}
          <span
            aria-hidden="true"
            class="cn-navigation-workspacetreenavigation-402-1"
            style={ledgerGuideStyle(guideDepth)}
          ></span>
        {/each}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="cn-navigation-workspacetreenavigation-410-1"
          aria-label={expanded
            ? `Collapse ${item.label}`
            : `Expand ${item.label}`}
          aria-expanded={expanded}
          disabled={item.disabled || !onExpandedIdsChange}
          onclick={() => updateExpansion(item.id)}
        >
          <ChevronRight
            class={cn(
              "cn-navigation-workspacetreenavigation-419-1",
              expanded && "cn-navigation-workspacetreenavigation-419-2",
            )}
            aria-hidden="true"
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="cn-navigation-workspacetreenavigation-427-1"
          title={item.label}
          disabled={item.disabled || !onSelect}
          onclick={() => onSelect?.(item.id)}
        >
          <Icon
            class="cn-navigation-workspacetreenavigation-432-1"
            aria-hidden="true"
          />
          <span class="cn-navigation-workspacetreenavigation-433-1"
            >{item.label}</span
          >
          {#if item.badge}
            <span class="cn-navigation-workspacetreenavigation-435-1"
              >{item.badge}</span
            >
          {/if}
        </Button>
      </div>
      {#if hasChildren && expanded}
        <div class="cn-navigation-workspacetreenavigation-442-1">
          {#each item.children ?? [] as child (child.id)}
            {@render LedgerTreeItem({ item: child, depth: depth + 1 })}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}
