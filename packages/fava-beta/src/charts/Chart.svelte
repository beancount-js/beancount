<script lang="ts">
  import { writable } from "svelte/store";
  import * as Select from "$lib/components/ui/select";

  import {
    barChartMode,
    chartToggledCurrencies,
    hierarchyChartMode,
    treemapCurrency,
    lineChartMode,
  } from "../stores/chart";

  import ChartLegend from "./ChartLegend.svelte";
  import BarChart from "./BarChart.svelte";
  import LineChart from "./LineChart.svelte";
  import HierarchyContainer from "./HierarchyContainer.svelte";
  import ModeSwitch from "./ModeSwitch.svelte";
  import type { FavaChart } from ".";
  import { getInterval, intervalLabel } from "../lib/interval";
  import { conversionLabel, getConversion } from "@beancount-js/beancount";
  import ScatterPlot from "./ScatterPlot.svelte";
  import { useContext } from "../context";

  const { conversion, interval } = useContext();
  /** The chart to render. */
  export let chart: FavaChart;
  export let hideButtons: boolean = false;

  /** Width of the chart. */
  let width: number;

  const treemapCurrencies = writable<string[]>([]);
  const legend = writable<[string, string | null][]>([]);

  function updateConversion(value: string) {
    conversion.set(getConversion(value));
  }

  function updateInterval(value: string) {
    interval.set(getInterval(value));
  }
</script>

<div class="flex-row">
  <div class="flex justify-between pb-2">
    <div class="mr-1">
      {#if chart.type === "barchart" || chart.type === "linechart"}
        <ChartLegend legend={$legend} toggled={chartToggledCurrencies} />
      {:else if $treemapCurrencies.length > 0}
        <ChartLegend
          legend={$treemapCurrencies.map((c) => [c, null])}
          active={treemapCurrency}
        />
      {/if}
    </div>
    <div class="flex">
      {#if !hideButtons}
        <Select.Root
          type="single"
          value={$conversion}
          onValueChange={updateConversion}
        >
          <Select.Trigger class="mr-1 w-[150px]">
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
          <Select.Trigger class="mr-1 w-auto">
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
        <ModeSwitch store={hierarchyChartMode} />
      {:else if chart.type === "linechart"}
        <ModeSwitch store={lineChartMode} />
      {:else if chart.type === "barchart" && chart.hasStackedData}
        <ModeSwitch store={barChartMode} />
      {/if}
    </div>
  </div>

  <span class="spacer"></span>
</div>
<div bind:clientWidth={width} class="w-full">
  {#if width}
    {#if chart.type === "barchart"}
      <BarChart {chart} {width} {legend} />
    {:else if chart.type === "hierarchy"}
      <HierarchyContainer {chart} {width} {treemapCurrencies} />
    {:else if chart.type === "linechart"}
      <LineChart {chart} {width} {legend} />
    {:else if chart.type === "scatterplot"}
      <ScatterPlot {chart} {width} />
    {/if}
  {/if}
</div>
