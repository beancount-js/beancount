<script lang="ts">
  import type { DirectiveBase } from "@beancount-js/beancount";
  import { onDestroy } from "svelte";
  import { useContext } from "../context";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import ActivityTable from "./ActivityTable.svelte";
  import AccountBulkActionSheet from "./AccountBulkActionSheet.svelte";
  import type { JournalRecord } from "./journal-table/model";

  const { conversion, ledgerData, ledgerSource } = useContext();

  let selectedKeys = $state(new Set<string>());
  let selectedRecords = $state<JournalRecord[]>([]);
  let bulkSheetOpen = $state(false);

  const balanceRoots = $derived([
    $ledgerSource.options.beancount.name_assets,
    $ledgerSource.options.beancount.name_liabilities,
  ]);
  const balancesByDate = $derived(
    $ledgerSource.data.accountBalanceByDate($conversion, ...balanceRoots),
  );

  $effect(() => {
    ingestionHeaderActions.set({
      kind: "account-activity",
      selectedCount: selectedKeys.size,
      onReplace: () => {
        bulkSheetOpen = true;
      },
    });
  });

  function handleSelectionChange(keys: Set<string>, records: JournalRecord[]) {
    selectedKeys = keys;
    selectedRecords = records;
  }

  function clearSelection() {
    selectedKeys = new Set();
    selectedRecords = [];
  }

  onDestroy(() => ingestionHeaderActions.set(null));
</script>

<ActivityTable
  directives={$ledgerData.directives as readonly DirectiveBase[]}
  {balancesByDate}
  {balanceRoots}
  bind:selectedKeys
  onSelectionChange={handleSelectionChange}
  tableId="journal-table"
  recordLabel="journal"
  pageLabel="Journal"
  amountHeading="Amount"
  balanceDescription="Shows the net worth balance for this date"
  emptyMessage="No dated records match the current Journal filter."
  linkAccounts={true}
/>

<AccountBulkActionSheet
  bind:open={bulkSheetOpen}
  records={selectedRecords}
  onApplied={clearSelection}
/>
