<script lang="ts">
  import { type PresetQuery } from "@lapis/ui/pages/PresetQueryView.svelte";
  import Statistics from "@lapis/ui/pages/Statistics.svelte";
  import { urlFor } from "../helpers";
  import QueryTable from "./QueryTable.svelte";

  const queries: readonly PresetQuery[] = [
    {
      id: "postings-per-account",
      name: "Postings per Account",
      query: `
            SELECT account, count(account)
            FROM postings
            GROUP BY account
            `,
    },
    {
      id: "update-activity",
      name: "Update Activity",
      query: `
            SELECT
                account,
                max(date) AS last_entry,
                sum(number) AS balance
            FROM postings
            GROUP BY account
            ORDER BY last_entry DESC
            `,
    },
    {
      id: "entries-per-type",
      name: "Entries Per Type",
      query: `
            SELECT type, count(type)
            FROM entries
            GROUP BY type
      `,
    },
  ];
</script>

<Statistics
  {queries}
  alignQueryActionEnd
  queryHref={(query) => urlFor("/query", { qs: query.query.trim() })}
>
  {#snippet children(query)}
    <QueryTable query={query.query} />
  {/snippet}
</Statistics>
