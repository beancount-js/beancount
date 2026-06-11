<script lang="ts">
    import VirtualList from "svelte-tiny-virtual-list";
    import { useDataset, type Column } from "./grid";
    import { derived, writable, type Readable } from "svelte/store";
    import { sortDataset, useSortableTable, type SortType } from "./sort";
    import Cell from "./Cell.svelte";
    // import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";
    import * as Alert from "$lib/components/ui/alert";
    export let data: Readable<Array<any>>;
    export let height: number = 500;
    export let rowHeight: number = 20;
    export let padding: number = 0;
    export let heightDiff: number = 0;
    export let model: Array<Column<any>> = [];

    const sortOrder =  writable<SortType>({});
    $: sortedData = derived([data, sortOrder], ([$data, $sortOrder]) => {
        const map: Record<string, Column<any>> = model.reduce((acc: Record<string, Column<any>>, cur) => {
            acc[cur.id] = cur;
            return acc;
        }, {});

        if ($sortOrder) {
            return sortDataset($data, $sortOrder, (row: any, key: string) => {
                if (map[key]) {
                    return map[key].value(row, 'sort');
                }
                return row[key];
            });
        }
        return $data;
    });
    $: table =  useDataset(sortedData, {height: rowHeight, padding, columns: model, heightDiff});
    $: ({getSize, columns, styles, maxHeight, widths} = $table);
</script>
<!-- <ScrollArea orientation="both"> -->
{#if !$sortedData.length}
<Alert.Root variant="default" class="mt-4 text-xs border-solid">
    <Alert.Description class="whitespace-pre-wrap">No records</Alert.Description>
</Alert.Root>
{:else}
<ol class="bean-table flex-table text-xs">
    <VirtualList height={Math.min(height, maxHeight)}  width="max-content" itemCount={$sortedData.length} itemSize={getSize}>
        <li class="head sticky top-0 z-10 border-solid border-l border-b border-t" slot="header">
            <p use:useSortableTable={sortOrder}>
                {#each columns as col}
                    {#if col.sortable}
                        <span data-sort={col.type} data-sort-name={col.id} style={styles[col.id]} class={'border-r ' + col.class || ""}>
                            <slot name="header" column={col}>{col.name}</slot>
                        </span>
                    {:else}
                        <span style={styles[col.id]} class={'border-r ' + col.class || ""}>
                            <slot name="header" column={col}>{col.name}</slot>
                        </span>
                    {/if}
                {/each}
            </p>
        </li>
        <div slot="item" let:index let:style class="align-middle" style={style}>
            <slot name="row" height={rowHeight} size={getSize(index, false)} styles={styles} widths={widths} value={$sortedData[index] || {}} columns={columns}>
                <div style={`line-height: ${rowHeight - 4}px`}>
                    <li class="border-l border-b" style={`height: ${getSize(index, false)}px`}>
                        <p class="h-full">
                            {#each model as column, i}
                                <slot name="cell" column={column} index={i} style={styles[column.id]} value={column.value($sortedData[index])} height={rowHeight}>
                                    <Cell class={column.class} style={styles[column.id]} value={column.value($sortedData[index])} type={column.type} height={rowHeight}></Cell>
                                </slot>
                            {/each}
                        </p>
                    </li>
                </div>
            </slot>
        </div>
    </VirtualList>
</ol>
{/if}
<!-- </ScrollArea> -->