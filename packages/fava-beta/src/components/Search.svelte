<script lang="ts">
  import { syntaxHighlighting } from "@codemirror/language";
  import Search, { type SearchResultGroup } from "@beancount-js/ui/pages/Search.svelte";
  import { get } from "svelte/store";
  import { useContext } from "../context";
  import { useNavigation } from "../router/router";
  import { debounceWithDelay } from "../hooks/debounce";
  import { classHighlighter } from "../codemirror/extensions/classHighlighter";
  import {
    appendLedgerSearchParams,
    cloneLedgerSearchState,
    createLedgerSearchFilterSyntax,
    facetsToFilterQuery,
    hasActiveLedgerSearchState,
    parseLedgerSearchState,
    type LedgerSearchSort,
    type LedgerSearchState,
  } from "../lib/ledger-search-state";
  import { journalRecords, type JournalRecord } from "./journal-table/model";
  import { formatDate } from "@beancount-js/parser";
  import type { FilterCommandOption } from "@beancount-js/ui/forms";

  const RESULT_LIMIT = 50;

  const { activeRoute, router } = useNavigation();
  const { query, accounts, payees, tags, years, ledgerData, ledgerOptions } =
    useContext();

  let filtersExpanded = $state(false);
  let searchState = $state<LedgerSearchState>(cloneLedgerSearchState());
  let lastSyncedSignature = $state("");
  let accountList = $state<readonly string[]>([]);
  let payeeList = $state<readonly string[]>([]);
  let tagList = $state<readonly string[]>([]);
  let yearList = $state<readonly string[]>([]);
  let directives = $state<JournalRecord[]>([]);
  let filterQueryLive = $state("");

  const TYPE_OPTIONS: FilterCommandOption[] = [
    { value: "all", label: "All types" },
    { value: "transaction", label: "Transaction" },
    { value: "balance", label: "Balance" },
    { value: "open", label: "Open" },
    { value: "close", label: "Close" },
    { value: "commodity", label: "Commodity" },
    { value: "pad", label: "Pad" },
    { value: "note", label: "Note" },
    { value: "document", label: "Document" },
    { value: "price", label: "Price" },
    { value: "event", label: "Event" },
    { value: "query", label: "Query" },
    { value: "custom", label: "Custom" },
  ];

  function withAllOption(
    label: string,
    values: readonly string[],
  ): FilterCommandOption[] {
    return [
      { value: "all", label: `All ${label.toLowerCase()}s` },
      ...values.map((value) => ({ value, label: value })),
    ];
  }

  function routeSignature(routeQuery: Record<string, string>) {
    const params = new URLSearchParams(routeQuery);
    return [
      params.get("searchQ") ?? "",
      params.get("searchSort") ?? "",
      params.get("searchType") ?? "",
      params.get("searchAccounts") ?? params.get("searchAccount") ?? "",
      params.get("searchPayees") ?? params.get("searchPayee") ?? "",
      params.get("searchTags") ?? params.get("searchTag") ?? "",
      params.get("searchYears") ?? params.get("searchYear") ?? "",
      params.get("query") ?? "",
    ].join("\0");
  }

  const [scheduleQuerySync, delayQuerySync] = debounceWithDelay(
    (next: LedgerSearchState) => {
      applySearchState(next);
    },
    300,
  );

  function applySearchState(next: LedgerSearchState) {
    searchState = cloneLedgerSearchState(next);
    const filterQuery = facetsToFilterQuery(next);
    query.set(filterQuery);

    const route = get(activeRoute);
    const params = new URLSearchParams(route.query);
    const record = params.get("record");
    appendLedgerSearchParams(params, next);
    if (record) params.set("record", record);
    const search = params.toString();
    lastSyncedSignature = routeSignature(Object.fromEntries(params));
    void router.updateState(search ? `?${search}` : "?");
  }

  function setFacet<K extends keyof LedgerSearchState>(
    key: K,
    value: LedgerSearchState[K],
  ) {
    applySearchState({ ...searchState, [key]: value });
  }

  function onQueryInput(value: string) {
    searchState = { ...searchState, query: value };
    scheduleQuerySync(searchState);
    delayQuerySync();
  }

  function clearSearch() {
    applySearchState({ ...searchState, query: "" });
  }

  function clearAll() {
    applySearchState(cloneLedgerSearchState());
  }

  function openRecord(key: string) {
    const route = get(activeRoute);
    const params = new URLSearchParams(route.query);
    appendLedgerSearchParams(params, searchState);
    params.set("record", key);
    const search = params.toString();
    // Query-only updates (same as ActivityTable) avoid rematching the view
    // path and keep deep-link open handling on the current route.
    void router.updateState(search ? `?${search}` : "?");
  }

  function sortRecords(
    records: JournalRecord[],
    sort: LedgerSearchSort,
  ): JournalRecord[] {
    if (sort === "relevance") return records;
    const next = [...records];
    if (sort === "dateDesc") {
      next.sort((a, b) => b.date.toMillis() - a.date.toMillis());
    } else if (sort === "dateAsc") {
      next.sort((a, b) => a.date.toMillis() - b.date.toMillis());
    } else if (sort === "title") {
      next.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );
    }
    return next;
  }

  function groupByDate(records: JournalRecord[]) {
    const groups: Array<{
      key: string;
      label: string;
      records: JournalRecord[];
    }> = [];
    const index = new Map<string, number>();
    for (const record of records) {
      const key = record.dateKey;
      const existing = index.get(key);
      if (existing === undefined) {
        index.set(key, groups.length);
        groups.push({
          key,
          label: formatDate(record.date),
          records: [record],
        });
      } else {
        groups[existing]!.records.push(record);
      }
    }
    return groups;
  }

  function toSearchResultGroups(
    groups: Array<{ key: string; label: string; records: JournalRecord[] }>,
  ): SearchResultGroup[] {
    return groups.map((group) => ({
      key: group.key,
      label: group.label,
      records: group.records.map((record) => ({
        key: record.key,
        title: record.title,
        detail: record.detail,
        type: record.type,
      })),
    }));
  }

  $effect(() => {
    return accounts.subscribe((value) => {
      accountList = value;
    });
  });
  $effect(() => {
    return payees.subscribe((value) => {
      payeeList = value;
    });
  });
  $effect(() => {
    return tags.subscribe((value) => {
      tagList = value;
    });
  });
  $effect(() => {
    return years.subscribe((value) => {
      yearList = value;
    });
  });
  $effect(() => {
    return query.subscribe((value) => {
      filterQueryLive = value ?? "";
    });
  });
  $effect(() => {
    return ledgerData.subscribe((data) => {
      const options = get(ledgerOptions);
      const balanceRoots = [
        options.beancount.name_assets,
        options.beancount.name_liabilities,
      ].filter(Boolean) as string[];
      directives = journalRecords(data.directives, balanceRoots);
    });
  });
  $effect(() => {
    return activeRoute.subscribe((route) => {
      const signature = routeSignature(route.query);
      if (signature === lastSyncedSignature) return;
      lastSyncedSignature = signature;
      const next = parseLedgerSearchState(route.query);
      searchState = next;
      const filterQuery = facetsToFilterQuery(next);
      if ((get(query) ?? "") !== filterQuery) {
        query.set(filterQuery);
      }
    });
  });

  const accountOptions = $derived(withAllOption("account", accountList));
  const payeeOptions = $derived(withAllOption("payee", payeeList));
  const tagOptions = $derived(
    withAllOption(
      "tag",
      tagList.map((tag) => tag.replace(/^#+/, "")),
    ),
  );
  const yearOptions = $derived(withAllOption("year", yearList));
  const activeSearch = $derived(hasActiveLedgerSearchState(searchState));
  const uniqueRecords = $derived.by(() => {
    const seen = new Set<string>();
    return directives.filter((record) => {
      if (seen.has(record.key)) return false;
      seen.add(record.key);
      return true;
    });
  });
  const sortedRecords = $derived(
    sortRecords(uniqueRecords, searchState.sort).slice(0, RESULT_LIMIT),
  );
  const totalMatches = $derived(directives.length);
  const resultGroups = $derived(
    toSearchResultGroups(groupByDate(sortedRecords)),
  );
  const hasAmbientFilter = $derived(Boolean(filterQueryLive.trim()));
  const filterEditorExtensions = $derived([
    syntaxHighlighting(classHighlighter),
  ]);
  const filterSyntax = $derived(
    createLedgerSearchFilterSyntax({
      types: TYPE_OPTIONS.filter((option) => option.value !== "all").map(
        (option) => option.value,
      ),
      accounts: accountList,
      payees: payeeList,
      tags: tagList,
      years: yearList,
    }),
  );
</script>

<Search
  bind:filtersExpanded
  {searchState}
  typeOptions={TYPE_OPTIONS}
  {accountOptions}
  {payeeOptions}
  {tagOptions}
  {yearOptions}
  {activeSearch}
  {hasAmbientFilter}
  {totalMatches}
  resultLimit={RESULT_LIMIT}
  {resultGroups}
  onValueChange={onQueryInput}
  onClearSearch={clearSearch}
  onClearAll={clearAll}
  onSortChange={(sort) => setFacet("sort", sort)}
  onTypesChange={(types) => setFacet("types", types)}
  onAccountsChange={(accounts) => setFacet("accounts", accounts)}
  onPayeesChange={(payees) => setFacet("payees", payees)}
  onTagsChange={(tags) => setFacet("tags", tags)}
  onYearsChange={(years) => setFacet("years", years)}
  onOpenRecord={openRecord}
  editorExtensions={filterEditorExtensions}
  {filterSyntax}
/>
