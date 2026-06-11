/** Data point for the scatterplot (events). */
export interface ScatterPlotDatum {
  readonly date: Date;
  readonly type: string;
  readonly description: string;
}

export class ScatterPlot {
  readonly type = "scatterplot";

  constructor(
    readonly name: string,
    readonly data: readonly ScatterPlotDatum[],
  ) {}
}

export function scatterplot(
  label: string,
  value: ScatterPlotDatum[],
): ScatterPlot {
  return new ScatterPlot(label, value);
}
