<script lang="ts">
  import type { DashboardLinePoint } from "@beancount-js/ui/dashboard/DashboardLine.svelte";
  import DashboardLine, {
    type DashboardLinePoint as SharedDashboardLinePoint,
    type DashboardTrendTone,
  } from "@beancount-js/ui/dashboard/DashboardLine.svelte";
  import type { DashboardPoint } from "./model";

  let {
    points = [],
    change = 0,
    currency = "",
    formatter = (value, currencyCode) => `${value} ${currencyCode}`,
    onPointFocus = () => {},
  }: {
    points?: readonly DashboardPoint[];
    currency?: string;
    change?: number;
    /** The change across the selected range, used by both UI and app-owned labels. */
    formatter?: (value: number, currency: string) => string;
    /** Report the active point while preserving app-owned chart semantics. */
    onPointFocus?: (point: DashboardPoint) => void;
  } = $props();

  const trendTone: DashboardTrendTone =
    change > 0 ? "positive" : change < 0 ? "negative" : "neutral";

  function uiPoint(point: DashboardPoint): SharedDashboardLinePoint {
    return {
      id: point.date.getTime().toString(),
      date: point.date,
      value: point.value,
      valueLabel: formatter(point.value, currency),
    };
  }

  const linePoints = $derived(points.map(uiPoint));

  function handlePointFocus(point: DashboardLinePoint) {
    const source = points.find((entry) => entry.date.getTime() === point.date.getTime());
    if (source) onPointFocus(source);
  }
</script>

<DashboardLine
  points={linePoints}
  {change}
  {trendTone}
  ariaLabel="Explore net worth by date"
  chartLabel="Net worth over time"
  emptyLabel="A longer date range is needed to chart this trend."
  valueFormatter={(value) => formatter(value, currency)}
  onPointFocus={handlePointFocus}
/>
