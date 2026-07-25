<script lang="ts">
  import type { Snippet } from "svelte";
  import StatementReport, {
    type StatementReportChart,
    type StatementReportSection,
  } from "./StatementReport.svelte";

  export type BalanceSheetChart = StatementReportChart;

  export type BalanceSheetSection = StatementReportSection & {
    [key: string]: unknown;
  };

  let {
    charts,
    sections,
    activeChartId,
    onActiveChartChange,
    chartChildren,
    sectionChildren,
    chartSwitcherAriaLabel = "Balance sheet chart",
  }: {
    charts: readonly BalanceSheetChart[];
    sections: readonly BalanceSheetSection[];
    activeChartId: string;
    onActiveChartChange?: (chartId: string) => void;
    /** Render the active chart content. */
    chartChildren?: Snippet<[string]>;
    /** Render one section body for each row. */
    sectionChildren?: Snippet<[BalanceSheetSection]>;
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
      {@render sectionChildren(section as BalanceSheetSection)}
    {/snippet}
  {/if}
</StatementReport>

