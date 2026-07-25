<script lang="ts">
  import type { Snippet } from "svelte";
  import StatementReport, {
    type StatementReportChart,
    type StatementReportSection,
  } from "./StatementReport.svelte";

  export type IncomeStatementChart = StatementReportChart;

  export type IncomeStatementSection = StatementReportSection & {
    [key: string]: unknown;
  };

  let {
    charts,
    sections,
    activeChartId,
    onActiveChartChange,
    chartChildren,
    sectionChildren,
    chartSwitcherAriaLabel = "Income statement chart",
  }: {
    charts: readonly IncomeStatementChart[];
    sections: readonly IncomeStatementSection[];
    activeChartId: string;
    onActiveChartChange?: (chartId: string) => void;
    /** Render the active chart's content. */
    chartChildren?: Snippet<[string]>;
    /** Render one section body for each row. */
    sectionChildren?: Snippet<[IncomeStatementSection]>;
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
      {@render sectionChildren(section as IncomeStatementSection)}
    {/snippet}
  {/if}
</StatementReport>

