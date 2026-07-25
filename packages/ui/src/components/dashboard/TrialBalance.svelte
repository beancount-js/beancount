<script lang="ts">
  import type { Snippet } from "svelte";
  import StatementReport, {
    type StatementReportChart,
    type StatementReportSection,
  } from "./StatementReport.svelte";

  export type TrialBalanceChart = StatementReportChart;

  export type TrialBalanceSection = StatementReportSection & {
    [key: string]: unknown;
  };

  let {
    charts,
    sections,
    activeChartId,
    onActiveChartChange,
    chartChildren,
    sectionChildren,
    chartSwitcherAriaLabel = "Trial balance chart",
  }: {
    charts: readonly TrialBalanceChart[];
    sections: readonly TrialBalanceSection[];
    activeChartId: string;
    onActiveChartChange?: (chartId: string) => void;
    chartChildren?: Snippet<[string]>;
    sectionChildren?: Snippet<[TrialBalanceSection]>;
    chartSwitcherAriaLabel?: string;
  } = $props();
</script>

<StatementReport
  {charts}
  sections={sections as readonly StatementReportSection[]}
  {activeChartId}
  {onActiveChartChange}
  {chartSwitcherAriaLabel}
>
  {#if chartChildren}
    {#snippet chartChildren(chartId)}
      {@render chartChildren(chartId)}
    {/snippet}
  {/if}
  {#if sectionChildren}
    {#snippet sectionChildren(section)}
      {@render sectionChildren(section as TrialBalanceSection)}
    {/snippet}
  {/if}
</StatementReport>

