<script lang="ts">
  import Chart from "../charts/Chart.svelte";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import * as ScrollArea from "@lapismd/design-core/shadcn/scroll-area";
  import type { BeancountChart } from ".";
  import { useContext } from "../context";

  const { lastActiveChartName } = useContext();

  export let charts: BeancountChart[];
  $: activeChart =
    charts.find((c) => c.name === $lastActiveChartName) ?? charts?.[0];
  function handleChange(value: string | undefined) {
    lastActiveChartName.set(value || "");
  }
</script>

<Tabs.Root value={activeChart.name} class="w-full" onValueChange={handleChange}>
  {#each charts as chart}
    <Tabs.Content value={chart.name}>
      <Chart {chart} />
    </Tabs.Content>
  {/each}
  <ScrollArea.Root orientation="horizontal" class="w-full">
    <div class="mx-auto w-max pb-2 pt-2">
      <Tabs.List>
        {#each charts as chart}
          <Tabs.Trigger value={chart.name}>{chart.name || "All"}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </div>
  </ScrollArea.Root>
</Tabs.Root>
