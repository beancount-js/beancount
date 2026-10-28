import { writable, type Writable } from "svelte/store";
import { useContext } from "../context";
export type HierarchyChartMode = "treemap" | "sunburst";
export type LineChartMode = "line" | "area";
export type BarChartMode = "stacked" | "single";
export type ValueStore<T> = Writable<T> & { values: () => [T, string][] };
function mode<T extends string>(
  value: T,
  options: [T, string][],
): ValueStore<T> {
  return { ...writable<T>(value), values: () => options };
}
export function createChartStores() {
  return {
    hierarchyChartMode: mode<HierarchyChartMode>("treemap", [
      ["treemap", "Treemap"],
      ["sunburst", "Sunburst"],
    ]),
    lineChartMode: mode<LineChartMode>("line", [
      ["line", "Line Chart"],
      ["area", "Area Map"],
    ]),
    barChartMode: mode<BarChartMode>("stacked", [
      ["stacked", "Stacked Bars"],
      ["single", "Single Bars"],
    ]),
    chartToggledCurrencies: writable<string[]>([]),
    treemapCurrency: writable<string | null>(null),
  };
}
export function useChartStores() {
  return useContext().chart;
}
