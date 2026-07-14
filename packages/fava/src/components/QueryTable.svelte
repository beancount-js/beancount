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
      return { data: [] };
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

  $: chart = chartData($data, columns);
</script>

<div>
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
    <div class="w-full pt-4">
      {#if chart}
        <div class="pb-2 text-xs">
          <Chart {chart} hideButtons />
        </div>
      {/if}
      <ol class="bean-table flex-table text-xs">
        <VirtualList
          height={Math.min(height, maxHeight)}
          width="max-content"
          itemCount={$data.length}
          itemSize={getSize}
        >
          <li
            class="head sticky top-0 z-10 border-b border-l border-t border-solid"
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
              <p>
                {#each columns.values as col}
                  <span
                    style={col.style}
                    class={"border-r border-solid " + col.class.join(" ")}
                  >
                    {#if col.id === "account" || matchesAccount(row[col.id])}
                      <span class="block" style={cellHeight}
                        ><a href={urlForAccount(row[col.id])}>{row[col.id]}</a
                        ></span
                      >
                    {:else if row[col.id] instanceof Inventory}
                      {#each [...row[col.id].values()] as position}
                        <span class="block text-right" style={cellHeight}
                          >{$ctx.money(position.units)}</span
                        >
                      {/each}
                    {:else if Array.isArray(row[col.id])}
                      {#each row[col.id] as item, i}
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
                    {:else if row[col.id] instanceof Date || row[col.id] instanceof DateTime}
                      <span class="block" style={cellHeight}
                        >{formatDate(
                          row[col.id] instanceof DateTime
                            ? row[col.id].toJSDate()
                            : row[col.id],
                        )}</span
                      >
                    {:else if row[col.id] instanceof Amount || row[col.id] instanceof Decimal}
                      <span class="block" style={cellHeight}
                        >{row[col.id] == 0 ? "" : $ctx.money(row[col.id])}</span
                      >
                    {:else}
                      {@const rowval = stringify(row[col.id])}
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
              </p>
            </li>
          </div>
        </VirtualList>
      </ol>
    </div>
  </ScrollArea.Root>
</div>
