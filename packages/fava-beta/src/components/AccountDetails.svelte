<script lang="ts">
  import AccountActivityTable from "./AccountActivityTable.svelte";
  import AccountDetails, {
    type AccountDetailsBreadcrumb,
    type AccountDetailsChart,
    type AccountDetailsTab,
  } from "@lapis/ui/pages/AccountDetails.svelte";
  import { balances } from "../charts/line";
  import { useChartContext } from "../charts/context";
  import { bar } from "../charts/bar";
  import Chart from "../charts/Chart.svelte";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import { stratify } from "../lib/tree";
  import type { Tree } from "../core/tree";
  import type { FavaChart } from "../charts";
  import type { AccountTreeNode } from "../lib/models";
  import { intervalLabel } from "../lib/interval";
  import { useContext } from "../context";
  import IntervalTreeTable from "./tree-table/IntervalTreeTable.svelte";
  import { useLedger } from "./helpers";
  import { urlForAccount } from "../helpers";
  import { useNavigation } from "../router/router";
  import { formatDate } from "@beancount-js/parser";

  const { conversion, interval } = useContext();
  const chartContext = useChartContext();
  const { activeRoute, router } = useNavigation();

  const DEFAULT_TAB = "account-table";

  export let account: string = "";

  $: ledgerData = useLedger();
  $: conversionContext = (asOf = $ledgerData.dateLast) => ({
    prices: $ledgerData.prices,
    date: asOf ?? undefined,
  });
  $: balanceTrees = $ledgerData.balanceTrees($interval);
  $: changeTrees = $ledgerData.changeTrees($interval);
  $: budgets = $ledgerData.intervalBudgets(account, $interval);
  $: chartEntries = [
    balances(
      `Account Balance`,
      $ledgerData.accountBalance(account, $conversion),
    ),
    bar(
      `Changes`,
      $ledgerData.intervalTotals([account], $conversion, $interval),
      $chartContext,
    ),
    hierarchyFromParsedData(
      account,
      $ledgerData.tree.get(account).toRecord($conversion, conversionContext()),
    ),
    ...changeTrees
      .slice(-3)
      .reverse()
      .map((it) =>
        hierarchyFromParsedData(
          `${formatDate(it.range.from, "MMM yyyy")}`,
          it.tree.get(account).toRecord($conversion, conversionContext(it.range.endInclusive)),
        ),
      ),
  ];
  $: chartById = new Map(
    chartEntries.map((chart) => [getChartId(chart.name), chart] as const),
  ) as ReadonlyMap<string, FavaChart>;

  $: createNodeFromTree = (tree: Tree, asOf = $ledgerData.dateLast) => {
    const context = conversionContext(asOf);
    return stratify(
      tree.get(account).accounts,
      (id) => id,
      (name: string) => {
        const node = tree.get(name);
        const entity: AccountTreeNode = {
          children: [],
          account: name,
          balance: node.balance.toRecord($conversion, context),
          balanceChildren: node.balanceChildren.toRecord($conversion, context),
          cost: {},
          costChildren: {},
          hasTxns: node.hasTxns,
        };
        return entity;
      },
    ).children[0];
  };

  $: balanceTreeNodes = balanceTrees
    .map((it) => createNodeFromTree(it.tree, it.range.endInclusive))
    .reverse();
  $: changeTreeNodes = changeTrees
    .map((it) => createNodeFromTree(it.tree, it.range.endInclusive))
    .reverse();

  $: balanceDates = balanceTrees.map((it) => it.range).reverse();
  $: changeDates = changeTrees.map((it) => it.range).reverse();
  $: ancestors = [...$ledgerData.tree.ancestors(account)]
    .map((it) => it.account)
    .filter((it) => it)
    .reverse();

  const getChartId = (name: string | undefined) => name || "All";
  let activeChartId = "";

  let chartOptions: readonly AccountDetailsChart[] = [];
  $: chartOptions = chartEntries.map((chart) => ({
    id: getChartId(chart.name),
    label: chart.name || "All",
  }));

  $: selectedChartId =
    chartOptions.some((chart) => chart.id === activeChartId) && activeChartId
      ? activeChartId
      : chartOptions[0]?.id ?? "";

  let tabs: readonly AccountDetailsTab[] = [];
  $: tabs = [
    { id: DEFAULT_TAB, label: "Account Table" },
    ...(changeTreeNodes.length > 0
      ? [{ id: "changes", label: `Changes (${intervalLabel($interval)})` }]
      : []),
    ...(balanceTreeNodes.length > 0
      ? [{ id: "balances", label: `Balances (${intervalLabel($interval)})` }]
      : []),
  ];
  $: selectedTab = tabs.some((tab) => tab.id === $activeRoute.query.tab)
    ? $activeRoute.query.tab
    : DEFAULT_TAB;
  let breadcrumbs: readonly AccountDetailsBreadcrumb[] = [];
  $: breadcrumbs = [
    { label: "Journal", href: "/journal" },
    ...ancestors.map((ancestor) => ({
      label: ancestor,
      href: urlForAccount(ancestor),
    })),
    { label: account, isPage: true },
  ];

  function handleChartChange(chartId: string) {
    activeChartId = chartId;
  }

  function handleTabChange(value: string | undefined) {
    if (!value || !tabs.some((tab) => tab.id === value)) return;
    const query = new URLSearchParams($activeRoute.query);
    if (value === DEFAULT_TAB) query.delete("tab");
    else query.set("tab", value);
    const next = query.toString();
    void router.updateState(next ? `?${next}` : "?");
  }

  const mapForChart = (chartId: string) => chartById.get(chartId);
</script>

<AccountDetails
  {account}
  {breadcrumbs}
  charts={chartOptions}
  activeChartId={selectedChartId}
  {tabs}
  activeTab={selectedTab}
  onActiveChartChange={handleChartChange}
  onActiveTabChange={handleTabChange}
  chartSwitcherAriaLabel="Account chart"
>
  {#snippet chartChildren(chartId)}
    {#if chartId}
      {@const chart = mapForChart(chartId)}
      {#if chart}
        <Chart {chart} />
      {/if}
    {/if}
  {/snippet}

  {#snippet accountChildren()}
    <AccountActivityTable {account} />
  {/snippet}

  {#snippet changesChildren()}
    <IntervalTreeTable
      trees={changeTreeNodes}
      dates={changeDates}
      {budgets}
      accumulate={true}
    />
  {/snippet}

  {#snippet balancesChildren()}
    <IntervalTreeTable
      trees={balanceTreeNodes}
      dates={balanceDates}
      {budgets}
      accumulate={true}
    />
  {/snippet}
</AccountDetails>
