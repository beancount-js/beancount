<script lang="ts">
  import type { Snippet } from "svelte";
  import ContentScrollArea from "../layout/ContentScrollArea.svelte";
  import ChartSwitcher from "../charts/ChartSwitcher.svelte";

  export type StatementReportChart = {
    id: string;
    label: string;
  };

  export type StatementReportSection = {
    title: string;
    href?: string;
    [key: string]: unknown;
  };

  let {
    charts,
    sections,
    activeChartId,
    onActiveChartChange,
    chartChildren,
    sectionChildren,
    chartSwitcherAriaLabel = "Statement chart",
  }: {
    charts: readonly StatementReportChart[];
    sections: readonly StatementReportSection[];
    /** Identifier of the currently visible chart tab. */
    activeChartId: string;
    /** Persisted selected chart id from the application layer. */
    onActiveChartChange?: (chartId: string) => void;
    /** Render the active chart's content. */
    chartChildren?: Snippet<[string]>;
    /** Render one section body for each row. */
    sectionChildren?: Snippet<[StatementReportSection]>;
    chartSwitcherAriaLabel?: string;
  } = $props();

  const normalizedActiveChartId = $derived(
    charts.some((chart) => chart.id === activeChartId) && activeChartId
      ? activeChartId
      : (charts[0]?.id ?? ""),
  );
</script>

<ContentScrollArea contentClass="scroll-container min-h-full">
  <div class="cn-dashboard-statementreport-47-1">
    <ChartSwitcher
      {charts}
      activeChartId={normalizedActiveChartId}
      ariaLabel={chartSwitcherAriaLabel}
      {onActiveChartChange}
    >
      {#if chartChildren}
        {#snippet children(chartId)}
          {@render chartChildren(chartId)}
        {/snippet}
      {/if}
    </ChartSwitcher>
  </div>

  <div class="cn-dashboard-statementreport-62-1" data-statement-report>
    {#each sections as section (section.title)}
      {#if sectionChildren}
        {@render sectionChildren(section)}
      {:else}
        <div class="cn-dashboard-statementreport-68-1">
          {section.title}
        </div>
      {/if}
    {/each}
  </div>
</ContentScrollArea>
