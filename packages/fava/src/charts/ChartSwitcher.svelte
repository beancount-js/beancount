<script lang="ts">
  import Chart from "../charts/Chart.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import type { FavaChart } from ".";
  import { useContext } from "../context";

  const { lastActiveChartName } = useContext();

  export let charts: FavaChart[];
  $: activeChart =
    charts.find((c) => c.name === $lastActiveChartName) ?? charts?.[0];
  function handleChange(value: string | undefined) {
    lastActiveChartName.set(value || "");
  }
</script>

<Tabs.Root
  value={activeChart.name}
  class="w-full overflow-auto"
  onValueChange={handleChange}
>
  {#each charts as chart}
    <Tabs.Content value={chart.name}>
      <Chart {chart} />
    </Tabs.Content>
  {/each}
  <div class="mx-auto max-w-max pb-2 pt-2">
    <Tabs.List>
      {#each charts as chart}
        <Tabs.Trigger value={chart.name}>{chart.name || "All"}</Tabs.Trigger>
      {/each}
    </Tabs.List>
  </div>
</Tabs.Root>
