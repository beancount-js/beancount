import type { BarChart } from "./bar";
import type { HierarchyChart } from "./hierarchy";
import type { LineChart } from "./line";
import type { ScatterPlot } from "./scatterplot";

export type FavaChart = HierarchyChart | BarChart | LineChart | ScatterPlot;
