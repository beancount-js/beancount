<script lang="ts">
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import ChartSwitcher from "../charts/ChartSwitcher.svelte";
  import { balances } from "../charts/line";
  import { useContext } from "../context";
  import { urlForAccount } from "../helpers";
  import AccountActivityTable from "./AccountActivityTable.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import type { AccountTreeNode } from "../lib/models";
  import { useLedger } from "./helpers";
  import { stratify } from "../lib/tree";
  import type { Tree } from "../core/tree";
  import { intervalLabel } from "../lib/interval";
  import IntervalTreeTable from "./tree-table/IntervalTreeTable.svelte";
  import { bar } from "../charts/bar";
  import { useChartContext } from "../charts/context";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import moment from "moment";
  import { formatDate } from "@beancount-js/parser";
  import ContentScrollArea from "./ContentScrollArea.svelte";
  import { useNavigation } from "../router/router";
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
  $: charts = () => {
    const charts = [
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
        $ledgerData.tree
          .get(account)
          .toRecord($conversion, conversionContext()),
      ),
      ...changeTrees
        .slice(-3)
        .reverse()
        .map((it) =>
          hierarchyFromParsedData(
            `${formatDate(it.range.from, "MMM yyyy")}`,
            it.tree
              .get(account)
              .toRecord($conversion, conversionContext(it.range.endInclusive)),
          ),
        ),
    ];

    return charts;
  };
  $: createNode = (tree: Tree, asOf = $ledgerData.dateLast) => {
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
    .map((it) => createNode(it.tree, it.range.endInclusive))
    .reverse();
  $: changeTreeNodes = changeTrees
    .map((it) => createNode(it.tree, it.range.endInclusive))
    .reverse();

  $: balanceDates = balanceTrees.map((it) => it.range).reverse();
  $: changeDates = changeTrees.map((it) => it.range).reverse();
  $: ancestors = [...$ledgerData.tree.ancestors(account)]
    .map((it) => it.account)
    .filter((it) => it)
    .reverse();
  $: availableTabs = [
    DEFAULT_TAB,
    ...(changeTreeNodes.length > 0 ? ["changes"] : []),
    ...(balanceTreeNodes.length > 0 ? ["balances"] : []),
  ];
  $: selectedTab = availableTabs.includes($activeRoute.query.tab)
    ? $activeRoute.query.tab
    : DEFAULT_TAB;

  function handleTabChange(value: string | undefined) {
    if (!value || !availableTabs.includes(value)) return;
    const query = new URLSearchParams($activeRoute.query);
    if (value === DEFAULT_TAB) query.delete("tab");
    else query.set("tab", value);
    const next = query.toString();
    void router.updateState(next ? `?${next}` : "?");
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <Breadcrumb.Root class="w-full shrink-0 p-3">
    <Breadcrumb.List>
      <Breadcrumb.Item>
        <Breadcrumb.Link href="/journal">Journal</Breadcrumb.Link>
      </Breadcrumb.Item>
      {#each ancestors as account}
        <Breadcrumb.Separator />
        <Breadcrumb.Link href={urlForAccount(account)}
          >{account}</Breadcrumb.Link
        >
      {/each}
      <Breadcrumb.Separator />
      <Breadcrumb.Item>
        <Breadcrumb.Page>{account}</Breadcrumb.Page>
      </Breadcrumb.Item>
    </Breadcrumb.List>
  </Breadcrumb.Root>
  <ContentScrollArea class="min-h-0 flex-1" contentClass="scroll-container">
    <div class="p-2">
      <ChartSwitcher charts={charts()} />
    </div>
    <div class="min-w-0 max-w-full p-2">
      <div class="flex min-w-0 max-w-full">
        <div class="w-full min-w-0 max-w-full">
          <Tabs.Root
            value={selectedTab}
            onValueChange={handleTabChange}
            class="min-w-0 max-w-full pt-2"
          >
            <Tabs.List>
              <Tabs.Trigger value="account-table">Account Table</Tabs.Trigger>
              {#if changeTreeNodes.length > 0}
                <Tabs.Trigger value="changes"
                  >Changes ({intervalLabel($interval)})</Tabs.Trigger
                >
              {/if}
              {#if balanceTreeNodes.length > 0}
                <Tabs.Trigger value="balances"
                  >Balances ({intervalLabel($interval)})</Tabs.Trigger
                >
              {/if}
            </Tabs.List>
            <Tabs.Content value="account-table">
              <AccountActivityTable {account} />
            </Tabs.Content>
            {#if changeTreeNodes.length > 0}
              <Tabs.Content value="changes">
                <IntervalTreeTable
                  trees={changeTreeNodes}
                  dates={changeDates}
                  {budgets}
                  accumulate={true}
                />
              </Tabs.Content>
            {/if}
            {#if balanceTreeNodes.length > 0}
              <Tabs.Content value="balances">
                <IntervalTreeTable
                  trees={balanceTreeNodes}
                  dates={balanceDates}
                  {budgets}
                  accumulate={true}
                />
              </Tabs.Content>
            {/if}
          </Tabs.Root>
        </div>
      </div>
    </div>
  </ContentScrollArea>
</div>
