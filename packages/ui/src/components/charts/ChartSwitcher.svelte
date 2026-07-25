<script lang="ts">
  import type { Snippet } from "svelte";
  import * as ScrollArea from "../shadcn/scroll-area";
  import * as Tabs from "../shadcn/tabs";

  export type ChartPerspective = {
    id: string;
    label: string;
  };

  let {
    charts,
    activeChartId,
    ariaLabel = "Chart perspectives",
    onActiveChartChange = () => {},
    children,
  }: {
    charts: readonly ChartPerspective[];
    activeChartId: string;
    ariaLabel?: string;
    onActiveChartChange?: (id: string) => void;
    /** Receives the active chart id so the parent can render its chart data. */
    children?: Snippet<[string]>;
  } = $props();
</script>

<Tabs.Root
  value={activeChartId}
  class="cn-charts-chartswitcher-29-1"
  onValueChange={(next) => {
    if (next) onActiveChartChange(next);
  }}
>
  <Tabs.Content value={activeChartId}>
    {@render children?.(activeChartId)}
  </Tabs.Content>
  <ScrollArea.Root
    orientation="horizontal"
    class="cn-charts-chartswitcher-37-1"
  >
    <div class="cn-charts-chartswitcher-38-1">
      <Tabs.List aria-label={ariaLabel}>
        {#each charts as chart (chart.id)}
          <Tabs.Trigger value={chart.id}>{chart.label || "All"}</Tabs.Trigger>
        {/each}
      </Tabs.List>
    </div>
  </ScrollArea.Root>
</Tabs.Root>
