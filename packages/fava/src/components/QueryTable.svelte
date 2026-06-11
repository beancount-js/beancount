<script lang="ts">
import * as Alert from "$lib/components/ui/alert";
import VirtualList from "svelte-tiny-virtual-list";

import { TriangleAlert } from "lucide-svelte";
import { derived, writable } from "svelte/store";
import {  stringify, useDataset, useLedger, type Columns } from "./helpers";
import { LedgerDatabase, LanguageRecord, RecordInventory } from "@beancount-js/beancount";
import { useCtx } from "../stores/format";
import { formatDate } from "@beancount-js/parser";
import { urlForAccount } from "../helpers";
import Highlighter from "./Highlighter.svelte";
import { matchesAccount } from "@beancount-js/beancount";
import { Tree } from "../core/tree";
import { CounterInventory, SimpleCounterInventory } from "@beancount-js/beancount";
import { DefaultMap } from "@beancount-js/beancount";
import { Amount, Decimal } from "@beancount-js/beancount";
import type { FavaChart } from "../charts";
import { hierarchyFromParsedData } from "../charts/hierarchy";
import Chart from "../charts/Chart.svelte";
import { balances } from "../charts/line";
import { useSortableTable, type SortType, sortDataset } from "../grid/sort"
    import { Position } from "@beancount-js/beancount";

export let height: number = 500;
export let rowHeight: number = 20;
export let query: string = "";
export let padding: number = 0;

const ctx = useCtx();
const ledgerData  = useLedger();


function countLines(content: any) {
    if (typeof content === "string") {
        return content.split("\n").length;
    }
    return 1;
}

function chartData(data: Array<Record<string, any>>, columns: Columns): FavaChart | null {
    if (!data.length || columns.ids.length !== 2) {
        return null;
    }
    const account = columns.values.find(it => it.type === "account");
    const date = columns.values.find(it => it.type === "date");
    const inventory = columns.values.find(it => it.type === "inventory" || it.type === "amount");

    if (account && inventory) {
        const tree = new Tree({});
        const accountBalances = new DefaultMap<string, CounterInventory>(
         () => new CounterInventory(),
        );

        data.forEach(row => {
            const acc = row[account.id];
            const amount = row[inventory.id];
            if (acc) {
                if (amount instanceof RecordInventory) {
                    for(const [currency, value] of Object.entries(amount.value)) {
                        accountBalances.get(acc).add(new Amount(value, currency));
                    }
                } else if (amount instanceof Amount) {
                    accountBalances.get(acc).add(amount); 
                } else if (amount instanceof SimpleCounterInventory) {
                    accountBalances.get(acc).addInventory(amount)
                } else if (amount instanceof CounterInventory) {
                    accountBalances.get(acc).addInventory(amount)
                } else if (amount instanceof Position) {
                    accountBalances.get(acc).add(amount.units, amount.cost)
                } else if(Array.isArray(amount)) {
                    amount.forEach(a => {
                        if (a instanceof Position) {
                            accountBalances.get(acc).add(a.units, a.cost);
                        } else if(a instanceof Amount) {
                            accountBalances.get(acc).add(a);
                        }
                    })
                }
            }
        });

        for (const [key, balance] of accountBalances.entries()) {
            tree.insertBalance(key, balance);
        }
        return hierarchyFromParsedData("Chart",  tree.root.toRecord())
    } else if (inventory && date) {
        return balances(`Balances`,  data.map(it => {
            return {date: it[date.id], balance: it[inventory.id].value }
        }));
    }

    return null;
}

const sortOrder =  writable<SortType>({});

$: queryResult = derived([ledgerData], ([$ledgerData]) => {
    if(!query) {
        return {data: []};
    }
    const response = $ledgerData.query(query);
    return response;
});

$: data = derived([queryResult, sortOrder], ([$queryResult, $sortOrder]) => {
    if ($sortOrder) {
        return sortDataset($queryResult.data, $sortOrder);
    }
    return $queryResult.data;
});


$: table =  useDataset(data, {height: rowHeight, padding});
$: ({getSize, columns, maxHeight} = $table);

$: chart = chartData($data, columns)
</script>
<div>
    {#if $queryResult.error}
    <Alert.Root variant="destructive" class="mt-4 text-xs font-mono">
        <TriangleAlert class="h-4 w-4" />
        <Alert.Title>Error</Alert.Title>
        <Alert.Description class="whitespace-pre-wrap">{$queryResult.error}</Alert.Description>
    </Alert.Root>
    {/if}
    <div class="overflow-x-auto">
        <div class="pt-4 w-full">
            {#if chart}
            <div class="text-xs pb-2">
                <Chart {chart} hideButtons />
            </div>
            {/if}
            <ol class="bean-table flex-table text-xs">
                <VirtualList height={Math.min(height, maxHeight)}  width="max-content" itemCount={$data.length} itemSize={getSize}>
                    <li class="head sticky top-0 z-10 border-solid border-l border-b border-t" slot="header">
                        <p use:useSortableTable={sortOrder}>
                            {#each columns.values as col}
                                <span data-sort={col.type} data-sort-name={col.id} style={col.style} class={"border-solid border-r " +  col.class.join(" ")}>{col.name}</span>
                            {/each}
                        </p>
                    </li>
                    <div slot="item"
                        let:index
                        let:style
                        class="align-middle"
                        style={`` + style}>
                        {@const row = $data[index]}
                        {@const cellHeight = `height: ${rowHeight - 1}px; line-height: ${rowHeight - 1}px; `}
                        <li class="border-solid border-l border-b">
                            <p>
                                {#each columns.values as col}
                                    <span style={col.style} class={"border-solid border-r " + col.class.join(" ")}>
                                        {#if col.id === "account" || matchesAccount(row[col.id])}
                                                <span class="block" style={cellHeight}><a href={urlForAccount(row[col.id])}>{row[col.id]}</a></span>
                                        {:else if row[col.id] instanceof RecordInventory}
                                            {#each Object.entries(row[col.id].value) as [currency, num]}
                                                <span class="block text-right" style={cellHeight}>{$ctx.money(num, currency)}</span>
                                            {/each}
                                        {:else if Array.isArray(row[col.id])}
                                            {#each row[col.id] as item, i}
                                                {@const rowval = stringify(item)}
                                                {@const lines = countLines(rowval)}
                                                {@const cellHeight = `height: ${(rowHeight * lines) - 1}px; line-height: ${rowHeight - 1}px; `}
                                                <div class:border-t={i > 0}>
                                                    {#if col.type === "account"}
                                                        <span class="block" style={cellHeight}><a href={urlForAccount(rowval)}>{rowval}</a></span>
                                                    {:else if item instanceof Amount || item instanceof Decimal}
                                                      {$ctx.money(item)}  
                                                    {:else if item instanceof Date}
                                                        {formatDate(item)}
                                                    {:else if item instanceof LanguageRecord}
                                                        <span class="block" style={cellHeight}><Highlighter code={item.code} parser={item.parser}></Highlighter></span>
                                                    {:else}
                                                    <span class:whitespace-pre={lines > 1} class="block" style={cellHeight}>{rowval}</span>
                                                    {/if}
                                                </div>
                                            {/each}    
                                        {:else if row[col.id] instanceof Date}
                                            <span class="block" style={cellHeight}>{formatDate(row[col.id])}</span> 
                                        {:else if  row[col.id] instanceof Amount ||  row[col.id] instanceof Decimal}
                                            <span class="block" style={cellHeight}>{row[col.id] == 0 ? "" : $ctx.money(row[col.id])}</span>  
                                        {:else if row[col.id] instanceof LanguageRecord}
                                            {@const rowval = stringify(row[col.id].code)}
                                            {@const lines = countLines(rowval)}
                                            {@const cellHeight = `height: ${(rowHeight * lines) - 1}px; line-height: ${rowHeight - 1}px; `}
                                            <span class="block" style={cellHeight}><Highlighter code={row[col.id].code} parser={row[col.id].parser}></Highlighter></span>
                                        {:else}
                                            {@const rowval = stringify(row[col.id])}
                                            {@const lines = countLines(rowval)}
                                            {@const cellHeight = `height: ${(rowHeight * lines) - 1}px; line-height: ${rowHeight - 1}px; `}
                                            <span class:whitespace-pre={countLines(rowval) > 1} class="block" style={cellHeight}>{rowval}</span>
                                        {/if}
                                    </span>
                                {/each}
                            </p>
                        </li>
                    </div>
                </VirtualList>
            </ol>
        </div>
    </div>
</div>