<script context="module" lang="ts">
  import type { AccountTreeNode } from "../lib/models";

  export type StatementSection = {
    tree: AccountTreeNode;
    title: string;
    href?: string;
  };
</script>

<script lang="ts">
  import ChartSwitcher from "../charts/ChartSwitcher.svelte";
  import type { FavaChart } from "../charts";
  import ContentScrollArea from "@beancount-js/ui/layout/ContentScrollArea.svelte";
  import StatementSummaryTreeTable from "./tree-table/StatementSummaryTreeTable.svelte";

  export let charts: FavaChart[] = [];
  export let sections: StatementSection[] = [];
</script>

<ContentScrollArea contentClass="scroll-container min-h-full">
  <div class="p-4">
    <ChartSwitcher {charts} />
  </div>
  <div class="grid w-full gap-8 p-4" data-statement-report>
    {#each sections as section (section.title)}
      <StatementSummaryTreeTable
        tree={section.tree}
        title={section.title}
        href={section.href}
      />
    {/each}
  </div>
</ContentScrollArea>
