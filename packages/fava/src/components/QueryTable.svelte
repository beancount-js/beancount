<script lang="ts">
  import * as Alert from "$lib/components/ui/alert";
  import VirtualList from "svelte-tiny-virtual-list";

  import { TriangleAlert } from "lucide-svelte";
  import { derived, writable } from "svelte/store";
  import { stringify, useDataset, useLedger, type Columns } from "./helpers";
  import { Inventory } from "@beancount-js/beancount";
  import { useCtx } from "../stores/format";
  import { Decimal, formatDate } from "@beancount-js/parser";
  import { DateTime } from "luxon";
  import { urlForAccount } from "../helpers";
  import { matchesAccount } from "@beancount-js/beancount";
  import { Tree } from "../core/tree";
  import {
    CounterInventory,
    SimpleCounterInventory,
  } from "@beancount-js/beancount";
  import { DefaultMap } from "@beancount-js/beancount";
  import { Amount } from "@beancount-js/beancount";
  import type { FavaChart } from "../charts";
  import { hierarchyFromParsedData } from "../charts/hierarchy";
  import Chart from "../charts/Chart.svelte";
  import { balances } from "../charts/line";
  import { useSortableTable, type SortType, sortDataset } from "../grid/sort";
  import { Position } from "@beancount-js/beancount";
  import { runBql } from "@beancount-js/beanquery";
  import * as ScrollArea from "$lib/components/ui/scroll-area";

  export let height: number = 500;
  export let rowHeight: number = 20;
  export let query: string = "";
  export let padding: number = 0;

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
  ): FavaChart | null {
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

  const sortOrder = writable<SortType>({});

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

  $: table = useDataset(data, { height: rowHeight, padding });
  $: ({ getSize, columns, maxHeight } = $table);

  // Query tables use their page scroll area as the vertical scroller. The
  // virtual-list package renders its header outside the measured item area,
  // so account for the 35px table heading when the rows fill the viewport.
  const headerHeight = 35;
  $: viewportHeight = Math.max(height, maxHeight + headerHeight);

  $: chart = chartData($data, columns);
</script>

<div class="query-table" data-query-table>
  {#if $queryResult.error}
    <Alert.Root variant="destructive" class="mt-4 font-mono text-xs">
      <TriangleAlert class="h-4 w-4" />
      <Alert.Title>Error</Alert.Title>
      <Alert.Description class="whitespace-pre-wrap"
        >{$queryResult.error}</Alert.Description
      >
    </Alert.Root>
  {/if}
  <ScrollArea.Root orientation="horizontal" class="w-full">
    <div class="w-full pr-3 pt-4">
      {#if chart}
        <div class="pb-2 text-xs">
          <Chart {chart} hideButtons />
        </div>
      {/if}
      <ol class="bean-table flex-table font-mono text-xs">
        <VirtualList
          height={viewportHeight}
          width="max-content"
          itemCount={$data.length}
          itemSize={getSize}
        >
          <li
            class="head sticky top-0 z-10 border-b border-l border-t border-solid bg-muted tracking-wide [font-variant-caps:all-small-caps]"
            slot="header"
          >
            <p use:useSortableTable={sortOrder}>
              {#each columns.values as col}
                <span
                  data-sort={col.type}
                  data-sort-name={col.id}
                  style={col.style}
                  class={"border-r border-solid " + col.class.join(" ")}
                  >{col.name}</span
                >
              {/each}
            </p>
          </li>
          <div
            slot="item"
            let:index
            let:style
            class="align-middle"
            style={`` + style}
          >
            {@const row = $data[index]}
            {@const cellHeight = `height: ${rowHeight - 1}px; line-height: ${rowHeight - 1}px; `}
            <li class="border-b border-l border-solid">
              <div>
                {#each columns.values as col}
                  {@const value = row[col.id]}
                  <span
                    style={col.style}
                    class={"border-r border-solid " + col.class.join(" ")}
                  >
                    {#if col.id === "account" || matchesAccount(value)}
                      <span class="block" style={cellHeight}
                        ><a href={urlForAccount(String(value ?? ""))}>{value}</a
                        ></span
                      >
                    {:else if value instanceof Inventory}
                      {#each [...value.values()] as position}
                        <span class="block text-right" style={cellHeight}
                          >{$ctx.money(position.units)}</span
                        >
                      {/each}
                    {:else if Array.isArray(value)}
                      {#each value as item, i}
                        {@const rowval = stringify(item)}
                        {@const lines = countLines(rowval)}
                        {@const cellHeight = `height: ${rowHeight * lines - 1}px; line-height: ${rowHeight - 1}px; `}
                        <div class:border-t={i > 0}>
                          {#if col.type === "account"}
                            <span class="block" style={cellHeight}
                              ><a href={urlForAccount(rowval)}>{rowval}</a
                              ></span
                            >
                          {:else if item instanceof Amount || item instanceof Decimal}
                            {$ctx.money(item)}
                          {:else if item instanceof Date || item instanceof DateTime}
                            {formatDate(
                              item instanceof DateTime ? item.toJSDate() : item,
                            )}
                          {:else}
                            <span
                              class:whitespace-pre={lines > 1}
                              class="block"
                              style={cellHeight}>{rowval}</span
                            >
                          {/if}
                        </div>
                      {/each}
                    {:else if value instanceof Date || value instanceof DateTime}
                      <span class="block" style={cellHeight}
                        >{formatDate(
                          value instanceof DateTime ? value.toJSDate() : value,
                        )}</span
                      >
                    {:else if value instanceof Amount || value instanceof Decimal}
                      <span class="block" style={cellHeight}
                        >{value instanceof Decimal && value.eq(0)
                          ? ""
                          : $ctx.money(value)}</span
                      >
                    {:else}
                      {@const rowval = stringify(value)}
                      {@const lines = countLines(rowval)}
                      {@const cellHeight = `height: ${rowHeight * lines - 1}px; line-height: ${rowHeight - 1}px; `}
                      <span
                        class:whitespace-pre={countLines(rowval) > 1}
                        class="block"
                        style={cellHeight}>{rowval}</span
                      >
                    {/if}
                  </span>
                {/each}
              </div>
            </li>
          </div>
        </VirtualList>
      </ol>
    </div>
  </ScrollArea.Root>
</div>

<style>
  .query-table :global(.virtual-list-wrapper) {
    overflow: visible;
  }
</style>
