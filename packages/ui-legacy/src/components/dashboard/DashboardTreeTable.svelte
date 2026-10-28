<script module lang="ts">
  export type {
    DashboardTreeContribution,
    DashboardTreeNode,
  } from "./dashboard-tree-table";
</script>

<script lang="ts">
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import * as ScrollArea from "../shadcn/scroll-area";
  import DashboardTreeRow from "./DashboardTreeRow.svelte";
  import {
    dashboardTreeCollapsibleIds,
    dashboardTreeContributions,
    dashboardTreeTotal,
    type DashboardTreeNode,
  } from "./dashboard-tree-table";

  let {
    nodes = [],
    title,
    ariaLabel = `${title} account hierarchy`,
    emptyLabel = "No accounts match this period.",
    viewAllLabel = "View account",
    valueFormatter = (value) => String(value),
    onNodeSelect = () => {},
    onViewAll,
  }: {
    nodes?: readonly DashboardTreeNode[];
    title: string;
    ariaLabel?: string;
    emptyLabel?: string;
    viewAllLabel?: string;
    valueFormatter?: (value: number) => string;
    /** Report an account/category activation without owning application routes. */
    onNodeSelect?: (node: DashboardTreeNode) => void;
    /** Report an explicit request to view the complete account group. */
    onViewAll?: () => void;
  } = $props();

  const accountColumn = "16rem";
  const weightMeterColumn = "4.5rem";
  const weightColumn = "5.5rem";
  const gridTemplate = `${accountColumn} ${weightMeterColumn} ${weightColumn} minmax(10rem, 1fr)`;

  let collapsed = $state<Set<string>>(new Set());
  const collapsibleIds = $derived(dashboardTreeCollapsibleIds(nodes));
  const allCollapsed = $derived(
    collapsibleIds.length > 0 &&
      collapsibleIds.every((id) => collapsed.has(id)),
  );
  const total = $derived(dashboardTreeTotal(nodes));
  const contributions = $derived(dashboardTreeContributions(nodes));

  function toggle(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  function toggleAll() {
    collapsed = allCollapsed ? new Set() : new Set(collapsibleIds);
  }
</script>

<section
  class="cn-dashboard-dashboardtreetable-68-1"
  aria-label={ariaLabel}
  data-dashboard-tree-table
>
  <div class="cn-dashboard-dashboardtreetable-72-1">
    <h2 class="cn-dashboard-dashboardtreetable-73-1">
      {title}
      <span class="cn-dashboard-dashboardtreetable-75-1"
        >· {total ? valueFormatter(total) : "—"}</span
      >
    </h2>
    {#if onViewAll}
      <button
        type="button"
        class="cn-dashboard-dashboardtreetable-82-1"
        onclick={onViewAll}
      >
        {viewAllLabel}
      </button>
    {/if}
  </div>

  {#if nodes.length}
    <div
      class="cn-dashboard-dashboardtreetable-92-1"
      role="img"
      aria-label={`${title} category contributions`}
      data-dashboard-contribution-bar
    >
      {#each contributions as contribution (contribution.id)}
        <span
          class="cn-dashboard-dashboardtreetable-99-1"
          style={`width: ${contribution.percentage}%; background: ${contribution.color}`}
          title={`${contribution.label}: ${valueFormatter(contribution.value)}`}
        ></span>
      {/each}
    </div>
    <div
      class="cn-dashboard-dashboardtreetable-106-1 contribution-legend"
      data-dashboard-contribution-legend
    >
      {#each contributions as contribution (contribution.id)}
        <span class="cn-dashboard-dashboardtreetable-111-1">
          <span
            class="cn-dashboard-dashboardtreetable-114-1"
            style={`background: ${contribution.color}`}
            aria-hidden="true"
          ></span>
          <span class="cn-dashboard-dashboardtreetable-118-1"
            >{contribution.label}</span
          >
          <span class="cn-dashboard-dashboardtreetable-121-1"
            >{contribution.percentage.toFixed(1)}%</span
          >
          <span class="cn-dashboard-dashboardtreetable-125-1"
            >{valueFormatter(contribution.value)}</span
          >
        </span>
      {/each}
    </div>

    <ScrollArea.Root
      orientation="horizontal"
      class="cn-dashboard-dashboardtreetable-134-1"
    >
      <ol
        class="cn-dashboard-dashboardtreetable-137-1"
        data-dashboard-tree-rows
      >
        <li
          class="cn-dashboard-dashboardtreetable-141-1"
          style={`grid-template-columns: ${gridTemplate}`}
        >
          <span class="cn-dashboard-dashboardtreetable-144-1">
            {#if collapsibleIds.length}
              <button
                type="button"
                class="cn-dashboard-dashboardtreetable-148-1"
                aria-label={allCollapsed
                  ? "Expand all accounts"
                  : "Collapse all accounts"}
                aria-pressed={allCollapsed}
                onclick={toggleAll}
              >
                <ChevronsUpDown
                  class="cn-dashboard-dashboardtreetable-155-1"
                  aria-hidden="true"
                />
              </button>
            {/if}
            Account
          </span>
          <span aria-hidden="true"></span>
          <span class="cn-dashboard-dashboardtreetable-161-1">Weight</span>
          <span class="cn-dashboard-dashboardtreetable-162-1">Value</span>
        </li>
        {#each nodes as node (node.id)}
          <DashboardTreeRow
            {node}
            {total}
            {gridTemplate}
            {collapsed}
            {valueFormatter}
            {onNodeSelect}
            onToggle={toggle}
          />
        {/each}
      </ol>
    </ScrollArea.Root>
  {:else}
    <p class="cn-dashboard-dashboardtreetable-179-1">
      {emptyLabel}
    </p>
  {/if}
</section>

<style>
  .contribution-legend {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
  }
</style>
