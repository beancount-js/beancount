<script lang="ts">
  import { type Conversion } from "@beancount-js/beancount";

  import { useContext } from "../context";
  import { useCtx } from "../stores/format";
  import type { AccountTreeNode } from "../lib/models";
  import { urlForAccount } from "../helpers";
  import FinancialDashboard, {
    type FinancialDashboardAccountGroup,
    type FinancialDashboardMetric,
    type FinancialDashboardNetWorth,
    type FinancialDashboardOutflow,
    type FinancialDashboardOption,
  } from "@beancount-js/ui/dashboard/FinancialDashboard.svelte";
  import {
    createDashboardData,
    dashboardCategoryColor,
    dashboardDefaultCurrency,
    dashboardCurrencies,
    dashboardPeriodComparisonLabels,
    dashboardPeriodLabels,
    dashboardTrendTone,
    type DashboardCategory,
    type DashboardPeriod,
  } from "./dashboard/model";

  const { ledgerData, ledgerOptions, conversion, operatingCurrency } =
    useContext();
  const ctx = useCtx();

  type DashboardSharedNode = {
    id: string;
    label: string;
    value: number;
    color?: string;
    children?: readonly DashboardSharedNode[];
  };

  const periods: DashboardPeriod[] = ["ytd", "1y", "3y", "all"];
  let period: DashboardPeriod = "ytd";
  let selectedCurrency = "";

  const syntheticFlowAccounts = new Set([
    "Other",
    "__dashboard-flow-deficit",
    "__dashboard-flow-surplus",
  ]);

  $: currencies = dashboardCurrencies($ledgerData);
  $: defaultCurrency = dashboardDefaultCurrency(currencies, $operatingCurrency);
  $: if (!selectedCurrency || !currencies.includes(selectedCurrency)) {
    selectedCurrency = defaultCurrency;
  }
  $: dashboard = createDashboardData(
    $ledgerData,
    $ledgerOptions,
    $conversion,
    period,
    selectedCurrency,
  );
  $: periodOptions = periods.map<FinancialDashboardOption>((periodOption) => ({
    value: periodOption,
    label: dashboardPeriodLabels[periodOption],
  }));
  $: currencyOptions = currencies.map((currency) => ({
    value: currency,
    label: currency,
  }));
  const valuationOptions: FinancialDashboardOption[] = [
    { value: "AT_COST", label: "At Cost" },
    { value: "AT_VALUE", label: "At Market Value" },
    { value: "UNITS", label: "Units" },
  ];
  $: metrics = mapMetrics();
  $: inflows = dashboard.inflows.map(mapCategory);
  $: outflows = dashboard.expenseCategories.map(mapOutflowCategory);
  $: accountGroups = mapAccountGroups(dashboard);
  $: netWorth = mapNetWorth();

  function mapCategory(category: DashboardCategory) {
    return {
      id: category.account,
      label: category.label,
      value: category.value,
      color: category.color,
    };
  }

  function mapOutflowCategory(
    category: DashboardCategory,
  ): FinancialDashboardOutflow {
    const share = dashboard.expenses
      ? ((category.value / dashboard.expenses) * 100).toFixed(1)
      : "0.0";

    return {
      id: category.account,
      label: category.label,
      value: category.value,
      color: category.color,
      shareLabel: `${share}%`,
    };
  }

  function mapMetrics(): FinancialDashboardMetric[] {
    return [
      {
        id: "income",
        label: "Income",
        valueLabel: $ctx.amount(dashboard.income, dashboard.currency),
      },
      {
        id: "expenses",
        label: "Outflows",
        valueLabel: $ctx.amount(dashboard.expenses, dashboard.currency),
      },
      {
        id: "cash-flow",
        label: "Net cash flow",
        valueLabel: $ctx.amount(dashboard.cashFlow, dashboard.currency),
        tone:
          dashboard.cashFlow > 0
            ? "positive"
            : dashboard.cashFlow < 0
              ? "negative"
              : "neutral",
        changeLabel: "",
      },
      {
        id: "net-worth",
        label: "Net worth",
        valueLabel: $ctx.amount(dashboard.netWorth, dashboard.currency),
        tone: dashboardTrendTone(dashboard.netWorthChange),
      },
    ];
  }

  function mapNetWorth(): FinancialDashboardNetWorth {
    return {
      valueLabel: $ctx.amount(dashboard.netWorth, dashboard.currency),
      change: dashboard.netWorthChange,
      changeLabel: `${$ctx.amount(dashboard.netWorthChange, dashboard.currency)}${
        dashboard.netWorthChangePercent === null
          ? ""
          : ` (${dashboard.netWorthChangePercent.toFixed(1)}%)`
      }`,
      changeDescription: dashboardPeriodComparisonLabels[period],
      trendTone: dashboardTrendTone(dashboard.netWorthChange),
      points: dashboard.netWorthPoints,
    };
  }

  function mapNode(
    node: AccountTreeNode,
    depthLevel: number,
    inheritedColor: string,
  ): DashboardSharedNode {
    const rawValue = node.balanceChildren[dashboard.currency];
    const value = Number.isFinite(rawValue ?? NaN) ? (rawValue as number) : 0;
    const childColor =
      depthLevel === 0
        ? dashboardCategoryColor(node.account)
        : inheritedColor;

    const children = node.children.map((child) =>
      mapNode(child, depthLevel + 1, childColor),
    );

    return {
      id: node.account,
      label: node.account.split(":").at(-1) ?? node.account,
      value,
      color: depthLevel === 0 ? undefined : inheritedColor,
      ...(children.length
        ? {
            children,
          }
        : undefined),
    };
  }

  function toSharedRoots(node: AccountTreeNode): DashboardSharedNode[] {
    const roots = node.account === "" ? node.children : [node];
    return roots.map((root) => mapNode(root, 0, "var(--primary)"));
  }

  function mapAccountGroups(data: {
    assets: AccountTreeNode;
    liabilities: AccountTreeNode;
    equity: AccountTreeNode;
  }): FinancialDashboardAccountGroup[] {
    return [
      {
        id: "assets",
        title: $ledgerOptions.beancount.name_assets,
        nodes: toSharedRoots(data.assets),
        emptyLabel: "No assets match this period.",
        viewAllLabel: "View account",
      },
      {
        id: "liabilities",
        title: $ledgerOptions.beancount.name_liabilities,
        nodes: toSharedRoots(data.liabilities),
        emptyLabel: "No liabilities match this period.",
        viewAllLabel: "View account",
      },
      {
        id: "equity",
        title: $ledgerOptions.beancount.name_equity,
        nodes: toSharedRoots(data.equity),
        emptyLabel: "No equity matches this period.",
        viewAllLabel: "View account",
      },
    ];
  }

  function isSyntheticFlow(account: string) {
    return syntheticFlowAccounts.has(account);
  }

  function maybeNavigate(account: string) {
    if (!account || isSyntheticFlow(account)) return;
    window.location.href = urlForAccount(account);
  }

  function updateConversion(value: string | string[] | undefined) {
    if (typeof value === "string") {
      conversion.set(value as Conversion);
    }
  }

  function updateCurrency(value: string | string[] | undefined) {
    if (typeof value === "string") selectedCurrency = value;
  }

  function updatePeriod(value: string) {
    period = value as DashboardPeriod;
  }

  function mapGroupRoot(groupId: string) {
    if (groupId === "assets") return $ledgerOptions.beancount.name_assets;
    if (groupId === "liabilities")
      return $ledgerOptions.beancount.name_liabilities;
    if (groupId === "equity") return $ledgerOptions.beancount.name_equity;
    return undefined;
  }
</script>

<FinancialDashboard
  eyebrow="Overview"
  title="Financial dashboard"
  period={period}
  {periodOptions}
  currency={dashboard.currency}
  currencyOptions={currencyOptions}
  valuation={$conversion}
  valuationOptions={valuationOptions}
  {metrics}
  inflows={inflows}
  outflows={outflows}
  {accountGroups}
  {netWorth}
  valueFormatter={(value) => $ctx.amount(value, dashboard.currency)}
  onPeriodChange={(value) => updatePeriod(value)}
  onCurrencyChange={(value) => updateCurrency(value)}
  onValuationChange={(value) => updateConversion(value)}
  onFlowCategorySelect={(category) => {
    maybeNavigate(category.id);
  }}
  onOutflowFocus={() => {}}
  onOutflowSelect={(category) => {
    maybeNavigate(category.id);
  }}
  onAccountSelect={(node) => {
    maybeNavigate(node.id);
  }}
  onAccountGroupSelect={(group) => {
    const root = mapGroupRoot(group.id);
    if (root) window.location.href = urlForAccount(root);
  }}
/>
