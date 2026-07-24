<script lang="ts">
  import type { Snippet } from "svelte";
  import ArrowDownWideNarrow from "lucide-svelte/icons/arrow-down-wide-narrow";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import ArrowUpNarrowWide from "lucide-svelte/icons/arrow-up-narrow-wide";
  import TriangleAlert from "lucide-svelte/icons/triangle-alert";
  import { cn } from "../../lib/utils";
  import PagePagination from "../navigation/PagePagination.svelte";
  import * as Select from "../shadcn/select";
  import * as Table from "../shadcn/table";

  export type QueryResultCell =
    | string
    | number
    | readonly (string | number)[]
    | null
    | undefined;

  export type QueryResultColumn = {
    id: string;
    label: string;
    /** Opt into local, presentation-only sorting for this column. */
    sortable?: boolean;
    align?: "left" | "right";
    class?: string;
    style?: string;
  };

  export type QueryResultRow = {
    id: string;
    values: Readonly<Record<string, QueryResultCell>>;
  };

  export type QueryResultsPagination = {
    page: number;
    pageCount: number;
    /** A fully formatted summary, for example “Showing 26–50 of 91”. */
    resultLabel: string;
    pageSize?: number;
    pageSizes?: readonly number[];
  };

  export type QueryResultsSortDirection = "ascending" | "descending" | "none";

  let {
    columns,
    rows,
    ariaLabel = "Query results",
    emptyLabel = "No results.",
    error,
    pagination,
    sortColumnId,
    sortDirection = "none",
    onPageChange = () => {},
    onPageSizeChange = () => {},
    onSortChange,
    beforeTable,
    cell,
  }: {
    columns: readonly QueryResultColumn[];
    rows: readonly QueryResultRow[];
    ariaLabel?: string;
    emptyLabel?: string;
    /** Query execution failures shown beneath a usable result table. */
    error?: string;
    /**
     * Controlled page information. Supply already-paged `rows`; this
     * component does not know the query's complete dataset.
     */
    pagination?: QueryResultsPagination;
    /**
     * Application-controlled sorting. When `onSortChange` is supplied, rows
     * remain in their provided order so the application can sort the complete
     * dataset before paging it.
     */
    sortColumnId?: string;
    sortDirection?: QueryResultsSortDirection;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    onSortChange?: (
      columnId: string,
      direction: QueryResultsSortDirection,
    ) => void;
    beforeTable?: Snippet;
    cell?: Snippet<[QueryResultRow, QueryResultColumn, QueryResultCell]>;
  } = $props();

  let sortedColumnId = $state<string>();
  let localSortDirection = $state<QueryResultsSortDirection>("none");

  const sortedRows = $derived.by(() => {
    if (onSortChange) return rows;
    const columnId = sortedColumnId;
    if (!columnId || localSortDirection === "none") return rows;
    const direction = localSortDirection === "ascending" ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        direction * compareCells(a.values[columnId], b.values[columnId]),
    );
  });

  function displayCell(value: QueryResultCell) {
    if (Array.isArray(value)) return value.map(String);
    return value == null ? ["—"] : [String(value)];
  }

  function compareCells(left: QueryResultCell, right: QueryResultCell) {
    const leftValue = displayCell(left).join("\n");
    const rightValue = displayCell(right).join("\n");
    const leftNumber = Number(leftValue);
    const rightNumber = Number(rightValue);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
    return leftValue.localeCompare(rightValue, undefined, { numeric: true });
  }

  function orderFor(column: QueryResultColumn): QueryResultsSortDirection {
    if (onSortChange) {
      return column.id === sortColumnId ? sortDirection : "none";
    }
    return column.id === sortedColumnId ? localSortDirection : "none";
  }

  function toggleSort(column: QueryResultColumn) {
    if (!column.sortable) return;
    const current = orderFor(column);
    const next =
      current === "ascending"
        ? "descending"
        : current === "descending"
          ? "none"
          : "ascending";
    if (onSortChange) {
      onSortChange(column.id, next);
      return;
    }
    if (column.id !== sortedColumnId) {
      sortedColumnId = column.id;
    }
    localSortDirection = next;
  }

  function setPageSize(value: string | undefined) {
    const pageSize = Number(value);
    if (pagination?.pageSizes?.includes(pageSize)) {
      onPageSizeChange(pageSize);
    }
  }
</script>

<div class="query-table space-y-3" data-query-table>
  {@render beforeTable?.()}
  <div
    class="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-sm"
  >
    <Table.Root aria-label={ariaLabel} class="min-w-max font-mono text-xs">
      <Table.Header class="bg-muted/65 text-muted-foreground">
        <Table.Row class="hover:bg-muted/65">
          {#each columns as column (column.id)}
            {@const order = orderFor(column)}
            <Table.Head
              aria-sort={column.sortable ? order : undefined}
              style={column.style}
              class={cn(
                "p-0",
                column.align === "right" && "text-right",
                column.class,
              )}
            >
              {#if column.sortable}
                <button
                  type="button"
                  class={cn(
                    "inline-flex h-10 w-full items-center gap-1.5 px-4 font-sans text-xs font-semibold uppercase tracking-wide outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    column.align === "right" && "justify-end",
                  )}
                  aria-label={`Sort by ${column.label}`}
                  onclick={() => toggleSort(column)}
                >
                  <span>{column.label}</span>
                  {#if order === "ascending"}
                    <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
                  {:else if order === "descending"}
                    <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
                  {:else}
                    <ArrowUpDown
                      class="size-3.5 opacity-50"
                      aria-hidden="true"
                    />
                  {/if}
                </button>
              {:else}
                <span
                  class="inline-flex h-10 items-center px-4 font-sans text-xs font-semibold uppercase tracking-wide"
                  >{column.label}</span
                >
              {/if}
            </Table.Head>
          {/each}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each sortedRows as row (row.id)}
          <Table.Row>
            {#each columns as column (column.id)}
              <Table.Cell
                style={column.style}
                class={cn(
                  "px-4 py-3 font-mono",
                  column.align === "right" && "text-right tabular-nums",
                  column.class,
                )}
              >
                {#if cell}
                  {@render cell(row, column, row.values[column.id])}
                {:else}
                  {#each displayCell(row.values[column.id]) as value, index}
                    <span
                      class:mt-1={index > 0}
                      class="block whitespace-pre-wrap"
                    >
                      {value}
                    </span>
                  {/each}
                {/if}
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell
              colspan={Math.max(columns.length, 1)}
              class="h-24 text-center font-sans text-sm text-muted-foreground"
            >
              {emptyLabel}
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
      {#if error}
        <Table.Footer
          class="border-t border-destructive/45 bg-destructive/10 text-foreground"
          data-query-error-footer
        >
          <Table.Row class="hover:bg-transparent">
            <Table.Cell colspan={Math.max(columns.length, 1)} class="px-4 py-3">
              <div class="flex items-start gap-2" role="alert">
                <TriangleAlert
                  class="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p class="font-sans text-xs font-semibold">
                    Could not run query
                  </p>
                  <p
                    class="mt-1 break-words font-mono text-[11px] leading-snug"
                  >
                    {error}
                  </p>
                </div>
              </div>
            </Table.Cell>
          </Table.Row>
        </Table.Footer>
      {/if}
    </Table.Root>
  </div>
  {#if pagination}
    <div
      class="flex flex-col gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-query-pagination
    >
      <span class="text-sm text-muted-foreground">{pagination.resultLabel}</span
      >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        {#if pagination.pageSize && pagination.pageSizes?.length}
          <div class="flex items-center gap-2">
            <span
              class="text-sm text-muted-foreground"
              id="query-results-page-size-label">Rows per page</span
            >
            <Select.Root
              type="single"
              value={String(pagination.pageSize)}
              onValueChange={setPageSize}
            >
              <Select.Trigger
                aria-labelledby="query-results-page-size-label"
                class="h-8 w-20 font-mono text-sm tabular-nums"
                data-query-page-size
              >
                {pagination.pageSize}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  {#each pagination.pageSizes as pageSize (pageSize)}
                    <Select.Item
                      value={String(pageSize)}
                      label={`${pageSize} records`}
                    >
                      {pageSize}
                    </Select.Item>
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>
        {/if}
        {#if pagination.pageCount > 1}
          <PagePagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            ariaLabel="Query result pages"
            {onPageChange}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>
