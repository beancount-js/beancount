<script lang="ts">
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import ChartSwitcher from "../charts/ChartSwitcher.svelte";
  import { balances } from "../charts/line";
  import { useContext } from "../context";
  import { AccountFilter } from "@beancount-js/filters";
  import { urlForAccount } from "../helpers";
  import AccountTable from "./AccountTable.svelte";
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
  import { ValidationError } from "@beancount-js/beancount";
  import type { ParseError } from "@beancount-js/parser";
  import type { Text } from "@codemirror/state";
  import type { Directive } from "@beancount-js/beancount";
  import { formatDate } from "@beancount-js/parser";
  const { conversion, interval } = useContext();
  const chartContext = useChartContext();

  export let account: string = "";
  export let onValueChange:
    | ((
        content: Text,
        directive: Directive,
      ) => Array<ValidationError | ParseError>)
    | undefined = undefined;

  $: ledgerData = useLedger(account ? AccountFilter.of(account) : undefined);
  $: balanceTrees = $ledgerData
    .balanceTrees($interval)
    .filter((it) => it.tree.currencies($conversion).length);
  $: changeTrees = $ledgerData
    .changeTrees($interval)
    .filter((it) => it.tree.currencies($conversion).length);
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
        $ledgerData.tree.get(account).toRecord($conversion),
      ),
      ...changeTrees
        .slice(-3)
        .reverse()
        .map((it) =>
          hierarchyFromParsedData(
            `${formatDate(it.range.from, "MMM yyyy")}`,
            it.tree.get(account).toRecord($conversion),
          ),
        ),
    ];

    return charts;
  };
  $: createNode = (tree: Tree) => {
    return stratify(
      tree.get(account).accounts,
      (id) => id,
      (name: string) => {
        const node = tree.get(name);
        const entity: AccountTreeNode = {
          children: [],
          account: name,
          balance: node.balance.toRecord($conversion),
          balanceChildren: node.balanceChildren.toRecord($conversion),
          cost: {},
          costChildren: {},
          hasTxns: node.hasTxns,
        };
        return entity;
      },
    ).children[0];
  };

  $: balanceTreeNodes = balanceTrees.map((it) => createNode(it.tree)).reverse();
  $: changeTreeNodes = changeTrees.map((it) => createNode(it.tree)).reverse();

  $: balanceDates = balanceTrees.map((it) => it.range).reverse();
  $: changeDates = changeTrees.map((it) => it.range).reverse();
  $: ancestors = [...$ledgerData.tree.ancestors(account)]
    .map((it) => it.account)
    .filter((it) => it)
    .reverse();
</script>

<Breadcrumb.Root class="w-full p-3">
  <Breadcrumb.List>
    <Breadcrumb.Item>
      <Breadcrumb.Link href="/journal">Journal</Breadcrumb.Link>
    </Breadcrumb.Item>
    {#each ancestors as account}
      <Breadcrumb.Separator />
      <Breadcrumb.Link href={urlForAccount(account)}>{account}</Breadcrumb.Link>
    {/each}
    <Breadcrumb.Separator />
    <Breadcrumb.Item>
      <Breadcrumb.Page>{account}</Breadcrumb.Page>
    </Breadcrumb.Item>
  </Breadcrumb.List>
</Breadcrumb.Root>
<div class="scroll-container no-bars">
  <div class="p-2">
    <ChartSwitcher charts={charts()} />
  </div>
  <div class="min-w-0 max-w-full p-2">
    <div class="flex min-w-0 max-w-full">
      <div class="w-full min-w-0 max-w-full">
        <Tabs.Root value="account-table" class="min-w-0 max-w-full pt-2">
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
            <AccountTable {account} {onValueChange}></AccountTable>
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
</div>
