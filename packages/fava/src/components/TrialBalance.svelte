<script lang="ts">
  import { createNode } from "../core/tree";
  import StatementSummaryTreeTable from "./tree-table/StatementSummaryTreeTable.svelte";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import Chart from "../charts/Chart.svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import { useContext } from "../context";
  import type { LedgerData } from "../lib/ledger-data";
  import type { Readable } from "svelte/store";
  import ContentScrollArea from "./ContentScrollArea.svelte";

  const context = useContext();

  export let ledgerData: Readable<LedgerData> = context.ledgerData;

  $: node = createNode($ledgerData.tree, "");
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

<ContentScrollArea contentClass="scroll-container min-h-full">
  <div class="w-full">
    <div class="p-4">
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
    <div class="w-full p-4">
      <StatementSummaryTreeTable tree={node} title="Trial Balance" />
    </div>
  </div>
</ContentScrollArea>
