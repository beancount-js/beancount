<script lang="ts">
  import { format as formatSql } from "sql-formatter";
  import Query from "@beancount-js/ui/pages/Query.svelte";
  import type { QueryHistory as QueryHistoryItem } from "@beancount-js/ui/navigation/QueryBox.svelte";
  import QueryTable from "./QueryTable.svelte";
  import { useNavigation } from "../router/router";
  import { useLedger } from "./helpers";
  import { queryHash, useQueryHistory } from "../stores/query";
  import { useContext } from "../context";
  import { bqlLanguage } from "../bql/bql";
  import { bqlCompletion } from "../bql/autocomplete";
  import { bqlStreamParser } from "../bql/parser";

  const { history } = useNavigation();
  const ledgerData = useLedger();
  const { bqlQuery } = useContext();

  let activeRoute = history.activeRoute;
  export let qs: string = formatQueryText($activeRoute.query["qs"] ?? "");
  export let selected = formatQueryText($activeRoute.query["selected"] ?? "");

  const queryHistory = useQueryHistory($ledgerData.filename.toLowerCase());
  let activeSelected = selected;

  let query = formatQueryText(qs || $bqlQuery);

  function formatQueryText(query: string): string {
    if (!query) {
      return "";
    }
    return formatSql(query, { language: "postgresql" }).replaceAll(" (", "(");
  }

  function executeQuery(nextQuery: string) {
    const submittedQuery = nextQuery.trim();
    if (!submittedQuery) {
      return;
    }
    if (submittedQuery.toUpperCase() === "CLEAR") {
      clearQuery();
      return;
    }

    const queryHashValue = queryHash(submittedQuery);
    activeSelected = queryHashValue;
    bqlQuery.set(submittedQuery);
    history.updateState({
      params: {
        qs: submittedQuery,
        selected: activeSelected,
      },
    });
    queryHistory.add(submittedQuery);
  }

  function clearQuery() {
    queryHistory.clear();
    bqlQuery.set("");
    activeSelected = "";
    history.updateState({ params: { qs: "" } });
  }

  function handleDelete(item: QueryHistoryItem) {
    queryHistory.remove(item.hash);
    if (activeSelected === item.hash) {
      activeSelected = "";
    }
  }

  function handleCopy(item: QueryHistoryItem) {
    bqlQuery.set(item.query);
    query = formatQueryText(item.query);
  }

  $: query = formatQueryText(qs || $bqlQuery);
  $: if (selected && selected !== activeSelected) {
    activeSelected = selected;
  }
</script>

<Query
  {query}
  queries={$queryHistory}
  selected={activeSelected}
  parser={bqlLanguage.parser}
  editorCompletion={bqlCompletion}
  editorStreamParser={bqlStreamParser}
  onSubmit={executeQuery}
  onDelete={handleDelete}
  onCopy={handleCopy}
  onClear={clearQuery}
  formatQueryText={(input) => formatQueryText(input)}
>
  {#snippet children(queryItem)}
    <QueryTable query={queryItem.query} />
  {/snippet}
</Query>
