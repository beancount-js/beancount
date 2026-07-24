import type { Conversion } from "@beancount-js/beancount";
import { DateFilter, DateRange } from "@beancount-js/filters";
import { DateTime } from "luxon";

import type { Options } from "../../context";
import type { LedgerData } from "../../core/ledger-data-class";
import type { AccountTreeNode } from "../../lib/models";
import { stratify } from "../../lib/tree";

export type DashboardPeriod = "ytd" | "1y" | "3y" | "all";

export interface DashboardCategory {
  account: string;
  label: string;
  value: number;
  color: string;
}

export interface DashboardPoint {
  date: Date;
  value: number;
}

export interface DashboardData {
  range: DateRange;
  currency: string;
  income: number;
  expenses: number;
  cashFlow: number;
  netWorth: number;
  netWorthChange: number;
  netWorthChangePercent: number | null;
  netWorthPoints: DashboardPoint[];
  netWorthStart: number;
  inflows: DashboardCategory[];
  outflows: DashboardCategory[];
  expenseCategories: DashboardCategory[];
  assets: AccountTreeNode;
  liabilities: AccountTreeNode;
  equity: AccountTreeNode;
}

const CATEGORY_COLORS = [
  "#f97316",
  "#3b82f6",
  "#0ea5e9",
  "#8b5cf6",
  "#10b981",
  "#eab308",
  "#ef4444",
  "#14b8a6",
  "#06b6d4",
  "#6366f1",
];

export const dashboardPeriodLabels: Record<DashboardPeriod, string> = {
  ytd: "Year to date",
  "1y": "Last 12 months",
  "3y": "Last 3 years",
  all: "All time",
};

export const dashboardPeriodComparisonLabels: Record<DashboardPeriod, string> =
  {
    ytd: "vs. start of year",
    "1y": "vs. 12 months ago",
    "3y": "vs. 3 years ago",
    all: "vs. first ledger entry",
  };

export function dashboardRange(
  period: DashboardPeriod,
  first: DateTime | null,
  now = DateTime.now(),
): DateRange {
  const end = now.endOf("day");
  const start = (() => {
    switch (period) {
      case "ytd":
        return end.startOf("year");
      case "1y":
        return end.minus({ years: 1 }).plus({ days: 1 }).startOf("day");
      case "3y":
        return end.minus({ years: 3 }).plus({ days: 1 }).startOf("day");
      case "all":
        return (first ?? end).startOf("day");
    }
  })();

  return new DateRange(start, end, "[]");
}

function scalar(record: Record<string, number>, currency: string) {
  return record[currency] ?? 0;
}

function shortAccountName(account: string) {
  return account.split(":").at(-1) ?? account;
}

export function dashboardCategoryColor(account: string) {
  let hash = 0;
  for (const character of account) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length];
}

export function dashboardPercentageChange(
  start: number,
  end: number,
): number | null {
  return start ? ((end - start) / Math.abs(start)) * 100 : null;
}

export type DashboardTrendTone = "positive" | "negative" | "neutral";

export function dashboardTrendTone(change: number): DashboardTrendTone {
  if (change > 0) return "positive";
  if (change < 0) return "negative";
  return "neutral";
}

export function dashboardSeriesWithBounds(
  points: DashboardPoint[],
  start: Date,
  end: Date,
  startValue: number,
  endValue: number,
): DashboardPoint[] {
  const startTime = start.getTime();
  const endTime = end.getTime();
  if (endTime <= startTime) return [{ date: end, value: endValue }];

  return [
    { date: start, value: startValue },
    ...points.filter((point) => {
      const time = point.date.getTime();
      return time > startTime && time < endTime;
    }),
    { date: end, value: endValue },
  ];
}

function accountTree(
  ledger: LedgerData,
  account: string,
  conversion: Conversion,
): AccountTreeNode {
  const tree = ledger.tree;
  return stratify(
    tree.get(account).accounts,
    (id) => id,
    (name) => {
      const node = tree.get(name);
      return {
        children: [],
        account: name,
        balance: node.balance.toRecord(conversion),
        balanceChildren: node.balanceChildren.toRecord(conversion),
        cost: {},
        costChildren: {},
        hasTxns: node.hasTxns,
      };
    },
  );
}

function leafCategories(
  node: AccountTreeNode,
  currency: string,
  multiplier: number,
): DashboardCategory[] {
  const result: DashboardCategory[] = [];
  const visit = (entry: AccountTreeNode) => {
    const amount = scalar(entry.balance, currency) * multiplier;
    if (!entry.children.length && amount) {
      result.push({
        account: entry.account,
        label: shortAccountName(entry.account),
        value: amount,
        color: dashboardCategoryColor(entry.account),
      });
    }
    entry.children.forEach(visit);
  };
  node.children.forEach(visit);
  return result;
}

/**
 * Keep the largest categories individually visible while retaining the total
 * represented by the chart. The returned category order is intentional: it
 * makes colours and labels stable as data changes.
 */
export function chartCategories(
  categories: DashboardCategory[],
  limit = 8,
): DashboardCategory[] {
  const positive = categories
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);
  const visible = positive.slice(0, limit);
  const rest = positive.slice(limit);
  const restValue = rest.reduce((sum, entry) => sum + entry.value, 0);
  if (restValue) {
    visible.push({
      account: "Other",
      label: "Other",
      value: restValue,
      color: "#a4a0b8",
    });
  }
  return visible;
}

function through(ledger: LedgerData, end: DateTime) {
  return ledger.copy({
    directives: ledger.directives.filter((directive) =>
      directive.date ? directive.date <= end : true,
    ),
  });
}

function before(ledger: LedgerData, start: DateTime) {
  return ledger.copy({
    directives: ledger.directives.filter((directive) =>
      directive.date ? directive.date < start : true,
    ),
  });
}

function chooseCurrency(ledger: LedgerData, selected: string | undefined) {
  const currencies = ledger.currencies;
  return (
    selected ??
    currencies.find((currency) => currency !== "") ??
    Object.keys(ledger.tree.root.balanceChildren.toRecord())[0] ??
    ""
  );
}

export function dashboardCurrencies(ledger: LedgerData) {
  return [...new Set(ledger.currencies)].filter(Boolean).sort();
}

export function dashboardDefaultCurrency(
  currencies: readonly string[],
  operatingCurrencies: readonly string[],
) {
  return (
    operatingCurrencies.find((currency) => currencies.includes(currency)) ??
    currencies[0] ??
    ""
  );
}

/**
 * Build the dashboard from the same ledger instance used by the reports. The
 * caller receives a ledger that already reflects Fava's global predicate; the
 * dashboard only applies its period boundary and never admits forecast rows
 * after today.
 */
export function createDashboardData(
  ledger: LedgerData,
  options: Options,
  conversion: Conversion,
  period: DashboardPeriod,
  selectedCurrency?: string,
): DashboardData {
  const range = dashboardRange(period, ledger.dateFirst);
  const currency = chooseCurrency(ledger, selectedCurrency);
  const periodLedger = ledger.filter(DateFilter.of(range));
  const asOfLedger = through(ledger, range.to);
  const priorLedger = before(ledger, range.from);
  const { beancount } = options;

  const incomeRoot = beancount.name_income;
  const expensesRoot = beancount.name_expenses;
  const assetsRoot = beancount.name_assets;
  const liabilitiesRoot = beancount.name_liabilities;
  const equityRoot = beancount.name_equity;

  const periodIncomeTree = accountTree(periodLedger, incomeRoot, conversion);
  const periodExpenseTree = accountTree(periodLedger, expensesRoot, conversion);
  const income = -scalar(
    periodLedger.tree.get(incomeRoot).balanceChildren.toRecord(conversion),
    currency,
  );
  const expenses = scalar(
    periodLedger.tree.get(expensesRoot).balanceChildren.toRecord(conversion),
    currency,
  );

  const rawIncome = leafCategories(periodIncomeTree, currency, -1);
  const rawExpenses = leafCategories(periodExpenseTree, currency, 1);
  const inflows = chartCategories([
    ...rawIncome.filter((entry) => entry.value > 0),
    ...rawExpenses
      .filter((entry) => entry.value < 0)
      .map((entry) => ({ ...entry, value: -entry.value })),
  ]);
  const outflows = chartCategories([
    ...rawExpenses.filter((entry) => entry.value > 0),
    ...rawIncome
      .filter((entry) => entry.value < 0)
      .map((entry) => ({ ...entry, value: -entry.value })),
  ]);

  const netWorthFor = (source: LedgerData) => {
    const assets = scalar(
      source.tree.get(assetsRoot).balanceChildren.toRecord(conversion),
      currency,
    );
    const liabilities = scalar(
      source.tree.get(liabilitiesRoot).balanceChildren.toRecord(conversion),
      currency,
    );
    return assets + liabilities;
  };
  const netWorth = netWorthFor(asOfLedger);
  const netWorthStart = netWorthFor(priorLedger);
  const netWorthChange = netWorth - netWorthStart;
  const netWorthChangePercent = dashboardPercentageChange(
    netWorthStart,
    netWorth,
  );
  const periodNetWorthPoints = ledger
    .netWorth([assetsRoot, liabilitiesRoot], conversion, "month")
    .filter((point) => range.contains(point.date))
    .map((point) => ({
      date: point.date,
      value: scalar(point.balance, currency),
    }));
  const netWorthPoints = dashboardSeriesWithBounds(
    periodNetWorthPoints,
    range.from.toJSDate(),
    range.to.toJSDate(),
    netWorthStart,
    netWorth,
  );

  return {
    range,
    currency,
    income,
    expenses,
    cashFlow: income - expenses,
    netWorth,
    netWorthChange,
    netWorthChangePercent,
    netWorthPoints,
    netWorthStart,
    inflows,
    outflows,
    expenseCategories: chartCategories(
      leafCategories(periodExpenseTree, currency, 1),
    ),
    assets: accountTree(asOfLedger, assetsRoot, conversion),
    liabilities: accountTree(asOfLedger, liabilitiesRoot, conversion),
    equity: accountTree(asOfLedger, equityRoot, conversion),
  };
}
