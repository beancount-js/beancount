<script lang="ts">
import Button from "$lib/components/ui/button/button.svelte";
import {
    urlFor
} from "../helpers";
import QueryTable from "./QueryTable.svelte";
let innerHeight = 500;
const queries: Array < {
    name: string;
    query: string;
} > = [
    {
        name: "Postings per Account",
        query: `
            SELECT 
                account,
                count(account)
            `
    },
    {
        name: "Update Activity",
        query: `
            SELECT
                account,
                last(date) as [Last Entry],
                units(sum(position)) as Balance
            WHERE account_sortkey(account) ~ "^[01]"
            GROUP BY account
            ORDER BY 2 DESC
            `
    },
    {
        name: "Entries Per Type",
        query: `
            raw SELECT 
                type,
                count(type)
            FROM directives
            GROUP BY type
            `
    },
];
</script>
<svelte:window bind:innerHeight />
<div class="scroll-container overflow-auto">
    <div class="flex">
        <div class="flex flex-wrap flex-row justify-center w-full">
            {#each queries as query}
            <div class={` p-2`}>
                <div class="flex justify-between items-center">
                    <h3 class="mr-1">{query.name}</h3>
                    <Button variant="outline" size="sm" href={urlFor("/query", {qs: query.query})}>Query</Button>
                </div>
                <QueryTable query={query.query} height={(innerHeight - 250) / 2} padding={(innerHeight - 250) / 4} />
            </div>
            {/each}
        </div>
    </div>
</div>