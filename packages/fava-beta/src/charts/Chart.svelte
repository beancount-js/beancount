<script lang="ts">
  import { writable } from "svelte/store";
  import * as Select from "@beancount-js/ui/shadcn/select";

  import {
    barChartMode,
    chartToggledCurrencies,
    hierarchyChartMode,
    treemapCurrency,
    lineChartMode,
  } from "../stores/chart";

  import UiChartLegend from "@beancount-js/ui/charts/ChartLegend.svelte";
  import UiChartModeSwitch from "@beancount-js/ui/charts/ChartModeSwitch.svelte";
  import UiHierarchyChart, {
    type HierarchyChartMode as UiHierarchyChartMode,
    type HierarchyChartNode as UiHierarchyChartNode,
  } from "@beancount-js/ui/charts/HierarchyChart.svelte";
  import ChartLegend from "./ChartLegend.svelte";
  import BarChart from "./BarChart.svelte";
  import LineChart from "./LineChart.svelte";
  import ModeSwitch from "./ModeSwitch.svelte";
  import type { FavaChart } from ".";
  import { getInterval, intervalLabel } from "../lib/interval";
  import { conversionLabel, getConversion } from "@beancount-js/beancount";
  import ScatterPlot from "./ScatterPlot.svelte";
  import { useContext } from "../context";
  import { useTreemapScale } from "./helpers";
  import { useCtx } from "../stores/format";
  import type { AccountHierarchyNode } from "./hierarchy";

  const { conversion, interval } = useContext();
  const formatContext = useCtx();
  const treemapScale = useTreemapScale();
  /** The chart to render. */
  export let chart: FavaChart;
  export let hideButtons: boolean = false;

  /** Width of the chart. */
  let width: number;

  const legend = writable<[string, string | null][]>([]);

  function updateConversion(value: string) {
    conversion.set(getConversion(value));
  }

  function updateInterval(value: string) {
    interval.set(getInterval(value));
  }

  $: hierarchyCurrencies =
    chart.type === "hierarchy" ? [...chart.data.keys()] : [];
  $: if (
    chart.type === "hierarchy" &&
    (!$treemapCurrency || !chart.data.has($treemapCurrency))
  ) {
    treemapCurrency.set(hierarchyCurrencies[0] ?? null);
  }
  $: hierarchyCurrency =
    chart.type === "hierarchy" && $treemapCurrency
      ? $treemapCurrency
      : hierarchyCurrencies[0];
  $: uiHierarchyMode = (
    $hierarchyChartMode === "sunburst" ? "sunburst" : "treemap"
  ) as UiHierarchyChartMode;
  $: hierarchyRoot =
    chart.type === "hierarchy" && hierarchyCurrency
      ? toHierarchyNode(
          chart.data.get(hierarchyCurrency),
          hierarchyCurrency,
          chart.name,
        )
      : undefined;

  function toHierarchyNode(
    node: AccountHierarchyNode | undefined,
    currency: string,
    rootLabel: string,
    path = "root",
    groupAccount = "",
  ): UiHierarchyChartNode | undefined {
    if (!node) return undefined;
    const account = node.data.account;
    const nextGroup =
      node.depth === 1 ? account : groupAccount || account || rootLabel;
    const value = node.value ?? 0;
    return {
      id: `${path}:${account || rootLabel}`,
      label:
        node.depth === 0
          ? rootLabel
          : account.split(":").pop() || account || rootLabel,
      value,
      valueLabel: $formatContext.amount(value, currency),
      color: node.depth === 0 ? "var(--primary)" : $treemapScale(nextGroup),
      children: node.children?.flatMap((child, index) => {
        const mapped = toHierarchyNode(
          child,
          currency,
          rootLabel,
          `${path}.${index}`,
          nextGroup,
        );
        return mapped ? [mapped] : [];
      }),
    };
  }
</script>

<div class="cn-beta-charts-src-charts-chart-111-1">
  <div class="cn-beta-charts-src-charts-chart-112-1">
    <div class="cn-beta-charts-src-charts-chart-113-1">
      {#if chart.type === "barchart" || chart.type === "linechart"}
        <ChartLegend legend={$legend} toggled={chartToggledCurrencies} />
      {:else if hierarchyCurrencies.length > 0}
        <UiChartLegend
          items={hierarchyCurrencies.map((currency) => ({
            id: currency,
            label: currency,
          }))}
          selection="single"
          selectedIds={hierarchyCurrency ? [hierarchyCurrency] : []}
          onSelectedIdsChange={(ids) => treemapCurrency.set(ids[0] ?? null)}
        />
      {/if}
    </div>
    <div class="cn-beta-charts-src-charts-chart-128-1">
      {#if !hideButtons}
        <Select.Root
          type="single"
          value={$conversion}
          onValueChange={updateConversion}
        >
          <Select.Trigger class="cn-beta-charts-src-charts-chart-135-1">
            {conversionLabel($conversion) || "At Cost"}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="AT_COST">At Cost</Select.Item>
            <Select.Item value="AT_VALUE">At Market Value</Select.Item>
            <Select.Item value="UNITS">Units</Select.Item>
          </Select.Content>
        </Select.Root>
        <Select.Root
          type="single"
          value={$interval}
          onValueChange={updateInterval}
        >
          <Select.Trigger class="cn-beta-charts-src-charts-chart-149-1">
            {intervalLabel($interval) || "Monthly"}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="year">Yearly</Select.Item>
            <Select.Item value="quarter">Quarterly</Select.Item>
            <Select.Item value="month">Monthly</Select.Item>
            <Select.Item value="week">Weekly</Select.Item>
            <Select.Item value="day">Daily</Select.Item>
          </Select.Content>
        </Select.Root>
      {/if}
      {#if chart.type === "hierarchy"}
        <UiChartModeSwitch
          value={uiHierarchyMode}
          options={hierarchyChartMode
            .values()
            .map(([value, label]) => ({ value, label }))}
          ariaLabel="Hierarchy representation"
          onChange={(value) =>
            hierarchyChartMode.set(value as typeof $hierarchyChartMode)}
        />
      {:else if chart.type === "linechart"}
        <ModeSwitch store={lineChartMode} />
      {:else if chart.type === "barchart" && chart.hasStackedData}
        <ModeSwitch store={barChartMode} />
      {/if}
    </div>
  </div>

  <span class="spacer"></span>
</div>
<div bind:clientWidth={width} class="cn-beta-charts-src-charts-chart-181-1">
  {#if width}
    {#if chart.type === "barchart"}
      <BarChart {chart} {width} {legend} />
    {:else if chart.type === "hierarchy" && hierarchyRoot}
      <UiHierarchyChart
        root={hierarchyRoot}
        mode={uiHierarchyMode}
        ariaLabel={`${chart.name} allocation`}
      />
    {:else if chart.type === "linechart"}
      <LineChart {chart} {width} {legend} />
    {:else if chart.type === "scatterplot"}
      <ScatterPlot {chart} {width} />
    {/if}
  {/if}
</div>
