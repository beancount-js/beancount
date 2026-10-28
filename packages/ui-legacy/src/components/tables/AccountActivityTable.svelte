<script lang="ts">
  import LedgerActivityTable, {
    type LedgerActivityGroup,
    type LedgerActivityRecord,
  } from "./LedgerActivityTable.svelte";

  export type { LedgerActivityGroup, LedgerActivityRecord };

  let {
    groups,
    selectedIds = [],
    selectable = true,
    ariaLabel = "Account activity",
    amountHeading = "Balance",
    balanceDescription = "Shows the running balance for this account on this date",
    emptyMessage = "No dated records match the current filter.",
    onSelectedIdsChange = () => {},
    onOpenRecord,
  }: {
    groups: readonly LedgerActivityGroup[];
    selectedIds?: readonly string[];
    selectable?: boolean;
    ariaLabel?: string;
    amountHeading?: string;
    balanceDescription?: string;
    emptyMessage?: string;
    onSelectedIdsChange?: (ids: string[]) => void;
    onOpenRecord?: (record: LedgerActivityRecord) => void;
  } = $props();
</script>

<LedgerActivityTable
  {groups}
  {selectedIds}
  {selectable}
  {ariaLabel}
  {amountHeading}
  {balanceDescription}
  {emptyMessage}
  {onSelectedIdsChange}
  {onOpenRecord}
/>
