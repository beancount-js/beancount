<script lang="ts">
  import type { DirectiveBase } from "@beancount-js/beancount";
  import { useContext } from "../context";
  import ActivityTable from "./ActivityTable.svelte";

  const { conversion, ledgerData, ledgerSource } = useContext();

  $: balanceRoots = [
    $ledgerSource.options.beancount.name_assets,
    $ledgerSource.options.beancount.name_liabilities,
  ];
  $: balancesByDate = $ledgerSource.data.accountBalanceByDate(
    $conversion,
    ...balanceRoots,
  );
</script>

<ActivityTable
  directives={$ledgerData.directives as readonly DirectiveBase[]}
  {balancesByDate}
  {balanceRoots}
  tableId="journal-table"
  recordLabel="journal"
  pageLabel="Journal"
  amountHeading="Amount"
  balanceDescription="Shows the net worth balance for this date"
  emptyMessage="No dated records match the current Journal filter."
/>
