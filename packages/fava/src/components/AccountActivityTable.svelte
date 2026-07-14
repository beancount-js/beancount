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
  import { useContext } from "../context";
  import { useLedger } from "./helpers";
  import ActivityTable from "./ActivityTable.svelte";

  export let account: string;

  const { conversion } = useContext();

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
</script>

<ActivityTable
  {directives}
  {balancesByDate}
  focusedAccount={account}
  tableId="account-activity-table"
  recordLabel="account activity"
  pageLabel="Account activity"
  amountHeading="Balance"
  balanceDescription="Shows the running balance for this account on this date"
  emptyMessage="No dated records match the current account filter."
  linkAccounts={true}
/>
