<script lang="ts">
  import { derived, writable } from "svelte/store";
  import { stringify, useDataset, useLedger, type Columns } from "./helpers";
  import { Inventory } from "@beancount-js/beancount";
  import { useCtx } from "../stores/format";
  import { Decimal, formatDate } from "@beancount-js/parser";
  import { DateTime } from "luxon";
  import { Tree } from "../core/tree";
  import {
    CounterInventory,
    SimpleCounterInventory,
  } from "@beancount-js/beancount";
  import { DefaultMap } from "@beancount-js/beancount";
  import { Amount } from "@beancount-js/beancount";
  import type { BeancountChart } from "../charts";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import Chart from "../charts/Chart.svelte";
  import { balances } from "../charts/line";
  import { type SortOrder, type SortType, sortDataset } from "../grid/sort";
  import { Position } from "@beancount-js/beancount";
  import { runBql } from "@beancount-js/beanquery";
  import QueryResultsTable, {
    type QueryResultCell,
    type QueryResultColumn,
    type QueryResultRow,
    type QueryResultsSortDirection,
  } from "../../components/tables/QueryResultsTable.svelte";
  import AccountLink from "./AccountLink.svelte";
  import { createTableTypography } from "../grid/typography";

  // Compatibility with existing report compositions; the recovered paged
  // renderer owns its rows and keeps the page as the vertical scroll lane.
  export let height = 500;
  export let rowHeight = 20;
  export let padding = 0;
  export let query: string = "";

  const PAGE_SIZES = [10, 25, 50, 100];

  const ctx = useCtx();
  const ledgerData = useLedger();

  function countLines(content: any) {
    if (typeof content === "string") {
      return content.split("\n").length;
    }
    return 1;
  }

  function chartData(
    data: Array<Record<string, any>>,
    columns: Columns,
  ): BeancountChart | null {
    if (!data.length || columns.ids.length !== 2) {
      return null;
    }
    const account = columns.values.find((it) => it.type === "account");
    const date = columns.values.find((it) => it.type === "date");
    const inventory = columns.values.find(
      (it) => it.type === "inventory" || it.type === "amount",
    );

    if (account && inventory) {
      const tree = new Tree({});
      const accountBalances = new DefaultMap<string, CounterInventory>(
        () => new CounterInventory(),
      );

      data.forEach((row) => {
        const acc = row[account.id];
        const amount = row[inventory.id];
        if (acc) {
          if (amount instanceof Inventory) {
            for (const position of amount.values()) {
              accountBalances.get(acc).add(position.units, position.cost);
            }
          } else if (amount instanceof Amount) {
            accountBalances.get(acc).add(amount);
          } else if (amount instanceof SimpleCounterInventory) {
            accountBalances.get(acc).addInventory(amount);
          } else if (amount instanceof CounterInventory) {
            accountBalances.get(acc).addInventory(amount);
          } else if (amount instanceof Position) {
            accountBalances.get(acc).add(amount.units, amount.cost);
          } else if (Array.isArray(amount)) {
            amount.forEach((a) => {
              if (a instanceof Position) {
                accountBalances.get(acc).add(a.units, a.cost);
              } else if (a instanceof Amount) {
                accountBalances.get(acc).add(a);
              }
            });
          }
        }
      });

      for (const [key, balance] of accountBalances.entries()) {
        tree.insertBalance(key, balance);
      }
      return hierarchyFromParsedData("Chart", tree.root.toRecord());
    } else if (inventory && date) {
      return balances(
        `Balances`,
        data.map((it) => {
          return { date: it[date.id], balance: it[inventory.id].value };
        }),
      );
    }

    return null;
  }

  const typography = createTableTypography();
  const sortOrder = writable<SortType>({});
  let page = 1;
  let pageSize = PAGE_SIZES[0];

  $: queryResult = derived([ledgerData], ([$ledgerData]) => {
    if (!query) {
      return { data: [], error: undefined };
    }
    return runBql($ledgerData.directives, query, {
      options: $ledgerData.options.beancount,
      errors: $ledgerData.errors,
    });
  });

  $: data = derived([queryResult, sortOrder], ([$queryResult, $sortOrder]) => {
    if ($sortOrder) {
      return sortDataset($queryResult.data, $sortOrder);
    }
    return $queryResult.data;
  });

  $: table = useDataset(data, { typography: typography.style });
  $: ({ columns } = $table);

  $: chart = chartData($data, columns);
  $: pageCount = Math.max(1, Math.ceil($data.length / pageSize));
  $: if (page > pageCount) page = pageCount;
  $: pageStart = (page - 1) * pageSize;
  $: pageEnd = Math.min(pageStart + pageSize, $data.length);
  $: visibleRows = $data.slice(pageStart, pageEnd);
  $: queryColumns = columns.values.map(
    (column): QueryResultColumn => ({
      id: column.id,
      label: column.name,
      sortable: true,
      align: column.class.includes("text-right") ? "right" : "left",
      class: column.class.join(" "),
      style: column.style,
    }),
  );
  $: columnTypes = Object.fromEntries(
    columns.values.map((column) => [column.id, column.type]),
  );
  $: queryRows = visibleRows.map((row, index): QueryResultRow => {
    const values = Object.fromEntries(
      columns.values.map((column) => [column.id, formatCell(row[column.id])]),
    );
    const lineCount = Math.max(
      1,
      ...Object.values(values).map((value) => displayValues(value).length),
    );
    return {
      id: String(pageStart + index),
      values: Object.fromEntries(
        Object.entries(values).map(([columnId, value]) => {
          if (lineCount === 1) return [columnId, value];
          const lines = displayValues(value);
          return [
            columnId,
            [...lines, ...Array(lineCount - lines.length).fill("")],
          ];
        }),
      ),
    };
  });
  $: activeSort = Object.entries($sortOrder)[0];
  $: sortColumnId = activeSort?.[0];
  $: sortDirection = sortDirectionFor(activeSort?.[1]?.order);

  function sortDirectionFor(
    order: SortOrder | undefined,
  ): QueryResultsSortDirection {
    if (order === "asc") return "ascending";
    if (order === "desc") return "descending";
    return "none";
  }

  function setSort(columnId: string, direction: QueryResultsSortDirection) {
    page = 1;
    sortOrder.set(
      direction === "none"
        ? {}
        : {
            [columnId]: {
              type: columns.definition[columnId]?.type ?? "string",
              order: direction === "ascending" ? "asc" : "desc",
            },
          },
    );
  }

  function setPageSize(next: number) {
    if (!PAGE_SIZES.includes(next)) return;
    pageSize = next;
    page = 1;
  }

  function formatCell(value: unknown): QueryResultCell {
    if (value instanceof Inventory) {
      return [...value.values()].map((position) => $ctx.money(position.units));
    }
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (item instanceof Amount || item instanceof Decimal) {
          return $ctx.money(item);
        }
        if (item instanceof Date || item instanceof DateTime) {
          return formatDate(item instanceof DateTime ? item.toJSDate() : item);
        }
        return stringify(item);
      });
    }
    if (value instanceof Date || value instanceof DateTime) {
      return formatDate(value instanceof DateTime ? value.toJSDate() : value);
    }
    if (value instanceof Amount || value instanceof Decimal) {
      return value instanceof Decimal && value.eq(0) ? "" : $ctx.money(value);
    }
    return stringify(value);
  }

  function displayValues(value: QueryResultCell): string[] {
    if (Array.isArray(value)) return value.map(String);
    return value == null ? ["—"] : [String(value)];
  }
</script>

{#snippet queryChart()}
  {#if chart}
    <div class="mt-4 rounded-xl border bg-card p-3 text-xs shadow-sm">
      <Chart {chart} hideButtons />
    </div>
  {/if}
{/snippet}

{#snippet queryCell(
  _row: QueryResultRow,
  column: QueryResultColumn,
  value: QueryResultCell,
)}
  {#each displayValues(value) as displayValue, index}
    <div
      class={column.align === "right"
        ? "-ml-2 -mr-8 min-h-[var(--query-line-height)] pl-2 pr-8"
        : "-mx-2 min-h-[var(--query-line-height)] px-2"}
      class:border-t={Array.isArray(value) && index > 0}
      data-query-cell-line
    >
      {#if columnTypes[column.id] === "account" && displayValue}
        <AccountLink account={displayValue} avatarSize="sm" />
      {:else}
        <span class:whitespace-pre={countLines(displayValue) > 1}>
          {displayValue}
        </span>
      {/if}
    </div>
  {/each}
{/snippet}

<div
  class="mt-4 font-mono text-xs"
  use:typography.measure
  style={`min-height: ${height}px; padding-bottom: ${padding}px; --query-line-height: ${rowHeight}px`}
>
  <QueryResultsTable
    columns={queryColumns}
    rows={queryRows}
    error={$queryResult.error}
    {sortColumnId}
    {sortDirection}
    onSortChange={setSort}
    pagination={$data.length > PAGE_SIZES[0]
      ? {
          page,
          pageCount,
          resultLabel: `Showing ${pageStart + 1}–${pageEnd} of ${$data.length}`,
          pageSize,
          pageSizes: PAGE_SIZES,
        }
      : undefined}
    onPageChange={(nextPage) => (page = nextPage)}
    onPageSizeChange={setPageSize}
    beforeTable={queryChart}
    cell={queryCell}
  />
</div>
