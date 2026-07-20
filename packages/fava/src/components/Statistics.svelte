<script lang="ts">
  import PresetQueryView from "./PresetQueryView.svelte";

  const queries: Array<{
    id: string;
    name: string;
    query: string;
  }> = [
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

<PresetQueryView {queries} alignQueryActionEnd />
