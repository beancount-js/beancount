<script lang="ts">
  import { stratify } from "../lib/tree";
  import type { AccountTreeNode } from "../lib/models";
  import TreeTableComponent from "./tree-table/TreeTable.svelte";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import Chart from "../charts/Chart.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import { useContext } from "../context";
  import type { LedgerData } from "../lib/ledger-data";
  import type { Readable } from "svelte/store";
  import ContentScrollArea from "./ContentScrollArea.svelte";

  const context = useContext();

  export let ledgerData: Readable<LedgerData> = context.ledgerData;

  $: createNode = (account: string) => {
    const tree = $ledgerData.tree;
    return stratify(
      tree.get(account).accounts,
      (id) => id,
      (name) => {
        const node = tree.get(name);
        const entity: AccountTreeNode = {
          children: [],
          account: name,
          balance: node.balance.toRecord(),
          balanceChildren: node.balanceChildren.toRecord(),
          cost: {},
          costChildren: {},
          hasTxns: node.hasTxns,
        };
        return entity;
      },
    );
  };

  $: node = createNode("");
  $: charts = ["Income", "Expenses", "Assets", "Liabilities", "Equity"].map(
    (account) => {
      return {
        account,
        data: hierarchyFromParsedData(
          account,
          $ledgerData.tree.get(account).toRecord(),
        ),
      };
    },
  );
</script>

<ContentScrollArea contentClass="scroll-container">
  <div class="w-full">
    <div class="p-2">
      <Tabs.Root value={charts[0].account} class="">
        {#each charts as chart}
          <Tabs.Content value={chart.account}>
            <Chart chart={chart.data} />
          </Tabs.Content>
        {/each}
        <div class="flex justify-center pt-2">
          <Tabs.List>
            {#each charts as chart}
              <Tabs.Trigger value={chart.account}>{chart.account}</Tabs.Trigger>
            {/each}
          </Tabs.List>
        </div>
      </Tabs.Root>
    </div>
    <div class="flex flex-wrap justify-start pl-4">
      <TreeTableComponent tree={node} end={null}></TreeTableComponent>
    </div>
  </div>
</ContentScrollArea>
