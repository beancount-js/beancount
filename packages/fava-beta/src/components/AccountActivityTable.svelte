<script lang="ts">
  import {
    Balance,
    Close,
    Open,
    Pad,
    Transaction,
    type DirectiveBase,
  } from "@beancount-js/beancount";
  import { AccountFilter } from "@beancount-js/filters";
  import { onDestroy } from "svelte";
  import { useContext } from "../context";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import { useLedger } from "./helpers";
  import ActivityTable from "./ActivityTable.svelte";
  import AccountBulkActionSheet from "./AccountBulkActionSheet.svelte";
  import type { JournalRecord } from "./journal-table/model";

  export let account: string;

  const { conversion } = useContext();
  const { activeLedgerKind } = useStudioWorkspace();

  let selectedKeys = new Set<string>();
  let selectedRecords: JournalRecord[] = [];
  let bulkSheetOpen = false;

  $: ledgerData = useLedger(AccountFilter.of(account));
  $: directives = $ledgerData.directives.filter(
    (directive) =>
      directive instanceof Transaction ||
      directive instanceof Pad ||
      directive instanceof Balance ||
      directive instanceof Open ||
      directive instanceof Close,
  ) as readonly DirectiveBase[];
  $: balancesByDate = $ledgerData.accountBalanceByDate($conversion, account);
  $: readOnly = $activeLedgerKind === "ingestion-review";

  $: {
    if (readOnly) {
      ingestionHeaderActions.set(null);
    } else {
      ingestionHeaderActions.set({
        kind: "account-activity",
        selectedCount: selectedKeys.size,
        onReplace: () => {
          bulkSheetOpen = true;
        },
      });
    }
  }

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
  {directives}
  {balancesByDate}
  focusedAccount={account}
  bind:selectedKeys
  onSelectionChange={handleSelectionChange}
  tableId="account-activity-table"
  recordLabel="account activity"
  pageLabel="Account activity"
  amountHeading="Balance"
  balanceDescription="Shows the running balance for this account on this date"
  emptyMessage="No dated records match the current account filter."
  linkAccounts={true}
  selectable={!readOnly}
/>

{#if !readOnly}
  <AccountBulkActionSheet
    bind:open={bulkSheetOpen}
    records={selectedRecords}
    focusedAccount={account}
    onApplied={clearSelection}
  />
{/if}
