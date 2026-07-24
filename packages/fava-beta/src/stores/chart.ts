import { writable } from "svelte/store";
import { storageSyncedStore, valueStore } from "./storage";
import { z } from "zod/v3";

const hierarchyChartSchema = z.union([
  z.literal("treemap"),
  z.literal("sunburst"),
]);
export type HierarchyChartMode = z.infer<typeof hierarchyChartSchema>;

const lineChartSchema = z.union([z.literal("line"), z.literal("area")]);
export type LineChartMode = z.infer<typeof lineChartSchema>;

const barChartSchema = z.union([z.literal("stacked"), z.literal("single")]);
export type BarChartMode = z.infer<typeof barChartSchema>;

/** The currently selected hierarchy chart mode. */
export const hierarchyChartMode = valueStore(
  storageSyncedStore<HierarchyChartMode>(
    "charts/hierarchy-chart-mode",
    () => "treemap",
    hierarchyChartSchema,
  ),
  () => [
    ["treemap", "Treemap"],
    ["sunburst", "Sunburst"],
  ],
);

/** The currently selected line chart mode. */
export const lineChartMode = valueStore(
  storageSyncedStore<LineChartMode>(
    "charts/line-chart-mode",
    () => "line",
    lineChartSchema,
  ),
  () => [
    ["line", "Line Chart"],
    ["area", "Area Map"],
  ],
);

/** The currently selected line chart mode. */
export const barChartMode = valueStore(
  storageSyncedStore<BarChartMode>(
    "charts/bar-chart-mode",
    () => "stacked",
    lineChartSchema,
  ),
  () => [
    ["stacked", "Stacked Bars"],
    ["single", "Single Bars"],
  ],
);

/** The currencies that are currently not shown in the bar and line charts. */
export const chartToggledCurrencies = storageSyncedStore<Array<string>>(
  "charts/toggled-currencies",
  () => [],
  z.string().regex(/^[A-Z][A-Z0-9'._-]{0,22}[A-Z0-9]$/),
);

/** The currency to show the treemap of. */
export const treemapCurrency = writable<string | null>(null);
