import { rollup } from "d3-array";
import type { Series } from "d3-shape";
import { stack, stackOffsetDiverging } from "d3-shape";

import type { ChartContext } from "./context";
import type { TooltipContent } from "./tooltip";
import { domHelpers } from "./tooltip";
import type { FormatterContext } from "../lib/format";
import type { DateRange } from "@beancount-js/filters";

export interface BarChartDatumValue {
  currency: string;
  value: number;
  budget: number;
}

/** The data for the bars of one interval. */
export interface BarChartDatum {
  /** The label of this interval. */
  label: string;
  /** The date of this interval. */
  date: Date;
  /** One value for each (operating) currency. */
  values: BarChartDatumValue[];
  /** The balances of the child accounts. */
  accountBalances: Record<string, Record<string, number>>;
}

export interface IntervalData {
  date: Date;
  dateRange: DateRange;
  budgets: Record<string, number>;
  balance: Record<string, number>;
  accountBalances: Record<string, Record<string, number>>;
}

export type ParsedBarChartData = Array<IntervalData>;

export class BarChart {
  readonly type = "barchart";

  /** The accounts that occur in some bar. */
  readonly accounts: string[];

  /** For each currency, the stacks (one series per account) */
  private readonly stacks: [
    currency: string,
    stacks: Series<BarChartDatum, string>[],
  ][];

  constructor(
    readonly name: string,
    /** The currencies that are shown in this bar chart. */
    readonly currencies: string[],
    /** The data for the (single) bars for all the intervals in this chart. */
    private readonly bar_groups: BarChartDatum[],
  ) {
    this.accounts = Array.from(
      new Set(bar_groups.map((d) => Object.keys(d.accountBalances)).flat(2)),
    ).sort();

    this.stacks = currencies.map((currency) => [
      currency,
      stack<BarChartDatum, string>()
        .keys(this.accounts)
        .value((d, account) => d.accountBalances[account]?.[currency] ?? 0)
        .offset(stackOffsetDiverging)(bar_groups)
        .filter((b) => b[0] !== b[1] && !Number.isNaN(b[1])),
    ]);
  }

  filter(hidden_names: string[]): {
    currencies: string[];
    bar_groups: BarChartDatum[];
    stacks: [currency: string, stacks: Series<BarChartDatum, string>[]][];
  } {
    const hidden_names_set = new Set(hidden_names);
    const currencies = new Set(
      this.currencies.filter((c) => !hidden_names_set.has(c)),
    );
    const bar_groups = this.bar_groups.map((b) => ({
      ...b,
      values: b.values.filter((v) => currencies.has(v.currency)),
    }));
    const stacks = this.stacks.filter((s) => currencies.has(s[0]));
    return { currencies: [...currencies], bar_groups, stacks };
  }

  /** Whether this chart contains any stacks (or is just a single account). */
  get hasStackedData(): boolean {
    return this.accounts.length > 1;
  }

  /** The tooltip for a hovered account in the stacked bar chart. */
  tooltipTextAccount(
    c: FormatterContext,
    d: BarChartDatum,
    account: string,
  ): TooltipContent {
    const content = [];
    content.push(domHelpers.em(account));
    content.push(domHelpers.br());
    d.values.forEach((a) => {
      const value = d.accountBalances[account]?.[a.currency] ?? 0;
      content.push(domHelpers.t(c.amount(value, a.currency)));
      content.push(domHelpers.br());
    });
    content.push(domHelpers.em(d.label));
    return content;
  }

  /** The tooltip for a hovered bar group in the bar chart. */
  tooltipText(c: FormatterContext, d: BarChartDatum): TooltipContent {
    const content = [];
    d.values.forEach((a) => {
      content.push(
        domHelpers.t(
          a.budget
            ? `${c.amount(a.value, a.currency)} / ${c.amount(
                a.budget,
                a.currency,
              )}`
            : c.amount(a.value, a.currency),
        ),
      );
      content.push(domHelpers.br());
    });
    content.push(domHelpers.em(d.label));
    return content;
  }
}

/** Get the currencies to use for the bar chart. */
function currenciesToShow(
  data: ParsedBarChartData,
  $chartContext: ChartContext,
): string[] {
  // Count the usage of each currency in the data.
  const counts = rollup(
    data.flatMap((interval) => [
      ...Object.keys(interval.budgets),
      ...Object.keys(interval.balance),
    ]),
    (v) => v.length,
    (r) => r,
  );

  // Show all operating currencies that are used in the data.
  const toShow = $chartContext.currencies.filter((c) => counts.delete(c));

  // Also add some of the most common other currencies (up to 5 in total)
  toShow.push(
    ...[...counts]
      .sort((a, b) => b[1] - a[1])
      .map((i) => i[0])
      .slice(0, Math.max(toShow.length, 5) - toShow.length),
  );

  return toShow;
}

/** Try to parse a bar chart. */
export function bar(
  label: string,
  data: ParsedBarChartData,
  $chartContext: ChartContext,
) {
  const currencies = currenciesToShow(data, $chartContext);
  const barGroups = data.map((interval) => ({
    values: currencies.map((currency) => ({
      currency,
      value: interval.balance[currency] ?? 0,
      budget: interval.budgets[currency] ?? 0,
    })),
    date: interval.date,
    label: $chartContext.dateFormat(interval.date),
    balances: interval.balance,
    accountBalances: interval.accountBalances,
  }));

  return new BarChart(label, currencies, barGroups);
}
