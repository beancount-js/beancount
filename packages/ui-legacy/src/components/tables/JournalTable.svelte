<script lang="ts">
  import ActivityTable, {
    type ActivityGroup,
    type ActivityRecord,
  } from "./ActivityTable.svelte";

  export type { ActivityGroup, ActivityRecord };

  let {
    groups,
    selectedIds = [],
    selectable = true,
    recordLabel = "journal",
    pageLabel = "Journal",
    amountHeading = "Amount",
    balanceDescription = "Shows the net worth balance for this date",
    emptyMessage = "No dated records match the current filter.",
    timeframes = [
      { id: "transactions", label: "Transactions" },
      { id: "upcoming", label: "Upcoming" },
    ],
    timeframe = "transactions",
    pageSizeOptions = [25, 50, 100],
    page = 1,
    pageSize = 50,
    onTimeframeChange = () => {},
    onPageChange = () => {},
    onPageSizeChange = () => {},
    onSelectedIdsChange = () => {},
    onOpenRecord,
    rowActionLabel = "Edit",
  }: {
    groups: readonly ActivityGroup[];
    selectedIds?: readonly string[];
    selectable?: boolean;
    recordLabel?: string;
    pageLabel?: string;
    amountHeading?: string;
    balanceDescription?: string;
    emptyMessage?: string;
    timeframes?: readonly { id: string; label: string }[];
    timeframe?: string;
    pageSizeOptions?: readonly number[];
    page?: number;
    pageSize?: number;
    onTimeframeChange?: (timeframe: string) => void;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    onSelectedIdsChange?: (ids: string[]) => void;
    onOpenRecord?: (record: ActivityRecord) => void;
    rowActionLabel?: string;
  } = $props();
</script>

<ActivityTable
  tableId="journal-table"
  {groups}
  {selectedIds}
  {selectable}
  {recordLabel}
  {pageLabel}
  {amountHeading}
  {balanceDescription}
  {emptyMessage}
  {timeframes}
  {timeframe}
  {pageSizeOptions}
  {page}
  {pageSize}
  {onTimeframeChange}
  {onPageChange}
  {onPageSizeChange}
  {onSelectedIdsChange}
  {onOpenRecord}
  {rowActionLabel}
/>
