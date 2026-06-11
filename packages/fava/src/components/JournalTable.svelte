<script lang="ts">
    import { formatDate } from "@beancount-js/parser";
    import { Balance, Close, Custom, DUPLICATE_META, isInstanceOf, Open, Pad, Query, Transaction, writeScalar } from "@beancount-js/beancount";
    import { useContext } from "../context";
    import { urlFor, urlForAccount, urlForDate } from "../helpers";
    import { Grid } from "../grid";
    import { derived, writable } from "svelte/store";
    import type { Column } from "../grid/grid";
    import { useCtx } from "../stores/format";
    import { UnfoldVertical, FoldVertical, Edit } from "lucide-svelte"

    import { chunk } from "./helpers";
    import EditorDialog from "./EditorDialog.svelte";
    import { cn } from "$lib/utils";
    const { ledgerData  } = useContext();
    const ctx = useCtx();

    const toggled = writable<Set<string>>(new Set<string>());

    function getHeight(transaction: Transaction): number {
        let size = 1;
        size += Math.ceil(transaction.postings.length / 10) - 1;
        if (transaction.tags.length) size++;
        if (transaction.links.length) size++;
        return size;
    }

    const model: Array<Column<any>> = [
        {id: 'date', name: 'Date', type: 'date', class: 'border-solid border-r',  sortable: true, value: (row) => formatDate(row.date)},
        {id: 'flag', name: 'F',  type: 'text', class: 'border-solid border-r',  sortable: true,  value: (row) => row.flag},
        {id: 'account', name: 'Account', type: 'account', class: 'border-solid border-r', sortable: true, value: (row: Transaction) => {
            const postings = (row.postings || []);
            const data = Array.from({ length: Math.ceil(postings.length / 10) - 1 }, () => '-');
            if (!data.length && row.accounts().length) {
                data.push([...row.accounts()].sort((a,b) => b.length - a.length)[0]);
            }
            if (Array.isArray(row.tags) && row.tags.length) {
                data.push([...row.tags].sort((a,b) => b.length - a.length)[0]);
            }
            if (Array.isArray(row.links) && row.links.length) {
                data.push([...row.links].sort((a,b) => b.length - a.length)[0]);
            }
            const dups = (row.meta[DUPLICATE_META] || []) as Transaction[];
            if (dups.length) {
                dups.forEach(dup => {
                    data.push("-");
                    if (dup.tags.length) {
                        data.push([...dup.tags].sort((a,b) => b.length - a.length)[0]); 
                    }
                    if (dup.links.length) {
                        data.push([...dup.links].sort((a,b) => b.length - a.length)[0]); 
                    }
                    data.push(...Array.from({ length: Math.ceil(dup.postings.length / 10) - 1 }, () => '-'));
                    if (!$toggled.has(dup.id)) {
                        data.push(...(dup.postings).map(it => it.account));
                    }
                });     
            }
            if ($toggled.has(row.id)) {
               return data;
            }
            // ${row.payee || ""} ${row.narration || ""}
            data.push(...(postings).map(it => it.account));
            console.log(data)
            return data;
        }},
        {id: 'units', name: 'Units', type: 'amount', class: 'border-solid border-r text-right', value: (row: any) => {
            if (row instanceof Transaction) {
                return $toggled.has(row.id) ? [] : (row.postings || []).map(it => it.units);
            } else if (row instanceof Balance) {
                return row.amount;
            }
            return [];
        }},
        {id: 'cost', name: 'Cost', type: 'amount', class: 'border-solid border-r text-right',  value: (row: Transaction) =>  $toggled.has(row.id) ? [] : (row.postings || []).map(it => it.cost)},
        {id: 'price', name: 'Price',  type: 'amount',class: 'border-solid text-right border-r',  value: (row: Transaction) =>  $toggled.has(row.id) ? [] : (row.postings || []).map(it => it.price)},
    ];
    $: data = derived([ledgerData, toggled], ([$ledgerData]) => {
        return $ledgerData
            .directives
            .filter(it => isInstanceOf(it, Transaction, Pad, Balance, Open, Close, Custom, Query))
            .reverse(); 
    });

    function handleToggle(evt: MouseEvent, tx: Transaction) {
        evt.preventDefault();
        toggled.update((t) => {
            const newSet = new Set(t);
            const isToggled = newSet.has(tx.id);
            if (isToggled) {
                newSet.delete(tx.id);
            } else {
                newSet.add(tx.id);
            }
            return newSet;
        });
    }

    let rowHeight = 24;
    $: now = new Date();
</script>

<div class="w-full p-3 flex flex-wrap justify-center">
    <Grid 
        height={window.innerHeight - 150}
        padding={window.innerHeight / 2}
        {rowHeight}
        heightDiff={3}
        {data}
        {model}
    >       
        <svelte:fragment slot="header" let:column>
            {#if column.id == "date" && $data.length}
            {#if !$toggled.size}
            <button 
                class="clickable-icon view-action inline-block" 
                aria-label="Unfold All"
                on:click={(evt) => {
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                    evt.stopPropagation();
                    toggled.set(new Set($ledgerData.directives.map(it => it.id)));
                }}
                >
                <UnfoldVertical />
            </button>
            {:else}
                <button 
                    class="clickable-icon view-action inline-block" 
                    aria-label="Fold All"
                    on:click={(evt) => {
                        evt.preventDefault();
                        evt.stopImmediatePropagation();
                        evt.stopPropagation();
                        toggled.set(new Set());
                    }}
                    >
                   <FoldVertical />
                </button>
            {/if}
                {column.name}
            {:else}
                {column.name}
            {/if}
        </svelte:fragment>
        <div slot="row"  class:opacity-45={value.date && value.date.getTime() > now.getTime()}  let:size let:value let:styles let:widths class="" style={`line-height: ${rowHeight - 4}px`}>
              {@const directive = value}
              {#if directive instanceof Transaction}
              <div style={`height: ${size}px`}>
              {#each [directive, ...(directive.meta[DUPLICATE_META] || [])] as entry, i}
              <li class={cn("transaction cleared border-solid border-l border-b", i > 0 && "bg-destructive/30 text-xs")} style={`height: ${ (getHeight(entry) * rowHeight) + ($toggled.has(entry.id) ? 0 : ((entry.postings.length) * rowHeight))}px`}>
                <p 
                    style={`height: ${ (getHeight(entry) * rowHeight)}px`}
                    data-style={`height: ${$toggled.has(entry.id) ? size : size - (entry.postings.length * rowHeight)}px`}>
                  <span class="datecell" style={styles.date}>
                    <a href={urlForDate(entry.date)}>{formatDate(entry.date)}</a>
                    <EditorDialog directive={entry} /> 
                  </span>
                  <span class="flag" style={`${styles.flag}`}>{entry.flag}</span>
                  <span aria-label={`${entry.payee || ""} ${entry.narration || ""}`.trim()} class="description droptarget text-ellipsis text-nowrap overflow-hidden" style={`width: ${widths.account + widths.price + widths.cost - 1}px`}>
                      <strong class="payee">{entry.payee}</strong>
                      {#if entry.narration}
                          <span class="separator"></span>{entry.narration}
                      {/if}
                  </span>
                  {#if (entry.tags.length + entry.links.length) > 0}
                  <div class="py-1 absolute left-1 overflow-hidden" style={`height: ${rowHeight * [entry.tags.length, entry.links.length].filter(it => it > 0).length}px; top: ${rowHeight}px; width: ${widths.date + widths.flag + widths.account + (directive.postings.length < 10 ? widths.units : 0)}px;`}>
                      {#each entry.tags as tag }
                          <a href={`?query=%23${tag}`} class="mr-1"><span class="cm-hashtag cm-hashtag-begin">#</span><span class="cm-hashtag cm-hashtag-end">{tag}</span></a>
                      {/each}
                      {#each entry.links as link }
                          <a href={`?query=^${link}`} class="mr-1"><span class="cm-link">^</span><span class="cm-link hover:underline">{link}</span></a>
                      {/each}
                  </div>
                  {/if}
                  <button type="button" class="h-auto block" style={styles.units} on:click={evt => handleToggle(evt, entry)}>
                        {#each chunk([...entry.postings], 10) as batch}
                            <div class="w-full indicators" style="height: 24px; padding: 5px 0;">
                                {#each batch as p}
                                    <span class="!bg-foreground"></span>
                                {/each}
                            </div>
                        {/each}
                    </button>
                   <span class="border-r"></span>
                </p>
                {#if !$toggled.has(entry.id)}
                    <ul class="postings border-t h-full">
                    {#each entry.postings as posting}
                        <li>
                            <p>
                                <span class="datecell" style={styles.date}></span>
                                <span class="flag" style={styles.flag}>{posting.flag}</span>
                                <span class="description droptarget" style={styles.account}><a href={urlForAccount(posting.account)}>{posting.account}</a></span>
                                <span class="num border-l border-r" style={styles.units}>{$ctx.money(posting.units)}</span>
                                <span class="num border-r" style={styles.cost}>{$ctx.money(posting.cost)}</span>
                                <span class="num border-r" style={styles.price}>{$ctx.money(posting.price)}</span>
                            </p>
                        </li>
                    {/each}
                    </ul>
                {/if}
              </li>
              {/each}
              </div>
              {:else if directive instanceof Open }
                <li class="border-l border-b" style={`height: ${size}px`}>
                    <p class="h-full">
                        <span class="datecell" style={styles.date}>
                            <a href={urlForDate(directive.date)}>{formatDate(directive.date)}</a>
                            <EditorDialog {directive} /> 
                        </span>
                        <span class="flag" style={styles.flag}>{directive.directiveType.toLocaleLowerCase()}</span>
                        <span class="description droptarget border-r" style={`width: ${widths.account + widths.units + widths.cost + widths.price}px`}>
                            <a href={urlForAccount(directive.account)}>{directive.account}</a>
                        </span>
                    </p>
                </li>
                {:else if directive instanceof Pad}
                <li class="border-l border-b" style={`height: ${size}px`}>
                    <p class="h-full">
                        <span class="datecell" style={styles.date}>
                            <a href={urlForDate(directive.date)}>{formatDate(directive.date)}</a>
                            <EditorDialog {directive} /> 
                        </span>
                        <span class="flag" style={styles.flag}>{directive.directiveType.toLocaleLowerCase()}</span>
                        <span class="description droptarget border-r" style={`width: ${widths.account + widths.units + widths.cost + widths.price}px`}>
                            <a href={urlForAccount(directive.sourceAccount)}>{directive.sourceAccount}</a>
                            &nbsp;from&nbsp;
                            <a href={urlForAccount(directive.account)}>{directive.account}</a>
                        </span>
                    </p>
                </li>
                {:else if directive instanceof Balance}
                <li class="border-l border-b" style={`height: ${size}px`}>
                    <p class="h-full">
                        <span class="datecell" style={styles.date}>
                            <a href={urlForDate(directive.date)}>{formatDate(directive.date)}</a>
                            <EditorDialog {directive} /> 
                        </span>
                        <span class="flag" style={styles.flag}>Bal</span>
                        <span class="description droptarget" style={styles.account}>
                            <a href={urlForAccount(directive.account)}>{directive.account}</a>
                        </span>
                        <span class="num bal border-l border-r" style={styles.units} title="">{$ctx.money(directive.amount)}</span>
                        <span class="border-r" style={`width: ${widths.cost + widths.price}px`}></span>
                    </p>
                </li> 
                {:else if directive instanceof Query}
                <li class="border-l border-b" style={`height: ${size}px`}>
                    <p class="h-full">
                        <span class="datecell" style={styles.date}>
                            <a href={urlForDate(directive.date)}>{formatDate(directive.date)}</a>
                            <EditorDialog {directive} /> 
                        </span>
                        <span class="flag" style={styles.flag}>Query</span>
                        <span class="description" style={`width: ${widths.description + widths.units + widths.cost + widths.price}px`}>
                            <a aria-label={directive.query} href={urlFor("/query", {"qs": directive.query})}>{directive.name}</a>
                        </span>
                    </p>
                </li> 
                {:else if directive instanceof Custom}
                <li class="border-l border-b" style={`height: ${size}px`}>
                    <p class="h-full">
                        <span class="datecell" style={styles.date}>
                            <a href={urlForDate(directive.date)}>{formatDate(directive.date)}</a>
                            <EditorDialog {directive} /> 
                        </span>
                        <span class="flag" style={styles.flag}>Custom</span>
                        <span class="description" style={`width: ${widths.description + widths.units + widths.cost + widths.price}px`}>
                            <strong>{directive.type}</strong>
                            {writeScalar([...directive.values])}
                        </span>
                    </p>
                </li> 
              {/if}
        </div>
    </Grid>
</div>