<script lang="ts">
  import IngestionReviewTable, {
    type IngestionReviewCounts,
    type IngestionReviewFilter,
    type IngestionReviewGroup,
    type IngestionReviewPosting,
    type IngestionReviewRow,
  } from "./IngestionReviewTable.svelte";

  export type { IngestionReviewCounts, IngestionReviewFilter, IngestionReviewGroup, IngestionReviewPosting, IngestionReviewRow };

  let {
    groups,
    counts,
    filter = "review",
    selectedIds = [],
    ariaLabel = "Import review queue",
    emptyLabel = "No proposals are waiting in this queue.",
    onFilterChange = () => {},
    onSelectedIdsChange = () => {},
    onOpenRow,
  }: {
    groups: readonly IngestionReviewGroup[];
    counts: IngestionReviewCounts;
    filter?: IngestionReviewFilter;
    selectedIds?: readonly string[];
    ariaLabel?: string;
    emptyLabel?: string;
    onFilterChange?: (filter: IngestionReviewFilter) => void;
    onSelectedIdsChange?: (ids: string[]) => void;
    onOpenRow?: (row: IngestionReviewRow) => void;
  } = $props();
</script>

<IngestionReviewTable
  {groups}
  {counts}
  {filter}
  {selectedIds}
  {ariaLabel}
  {emptyLabel}
  {onFilterChange}
  {onSelectedIdsChange}
  {onOpenRow}
/>
