<script lang="ts">
  import {
    FilterCommandPicker,
    type FilterCommandOption,
  } from "@beancount-js/forms";
  import { SearchFilterBar } from "@beancount-js/ui/forms";
  import { syntaxHighlighting } from "@codemirror/language";
  import ChevronRightIcon from "lucide-svelte/icons/chevron-right";
  import ChevronsDownUpIcon from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDownIcon from "lucide-svelte/icons/chevrons-up-down";
  import { get } from "svelte/store";
  import { cn } from "$lib/utils.js";
  import { Badge } from "$lib/components/ui/badge";
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
  let openGroups = $state<Record<string, boolean>>({});

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

  const SORT_OPTIONS: FilterCommandOption[] = [
    { value: "relevance", label: "Best match" },
    { value: "dateDesc", label: "Newest first" },
    { value: "dateAsc", label: "Oldest first" },
    { value: "title", label: "Title (A to Z)" },
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

  function isGroupOpen(groupId: string) {
    return openGroups[groupId] ?? true;
  }

  function toggleGroup(groupId: string) {
    openGroups = { ...openGroups, [groupId]: !isGroupOpen(groupId) };
  }

  function toggleAllGroups() {
    const open = hasCollapsedGroups;
    openGroups = resultGroups.reduce<Record<string, boolean>>((next, group) => {
      next[group.key] = open;
      return next;
    }, {});
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
  const resultGroups = $derived(groupByDate(sortedRecords));
  const hasResultGroups = $derived(resultGroups.length > 0);
  const hasCollapsedGroups = $derived(
    resultGroups.some((group) => !isGroupOpen(group.key)),
  );
  const hasAmbientFilter = $derived(Boolean(filterQueryLive.trim()));
  const filterEditorExtensions = [syntaxHighlighting(classHighlighter)];
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

<div class="ledger-search flex min-h-0 flex-1 flex-col">
  <SearchFilterBar
    value={searchState.query}
    placeholder="Search ledger…"
    ariaLabel="Search ledger"
    clearSearchLabel="Clear search"
    clearAllLabel="Clear all filters"
    expandFiltersLabel="Expand filter options"
    collapseFiltersLabel="Collapse filter options"
    showActiveQueryChip={true}
    showFilterToggle={true}
    showClearAll={activeSearch}
    clearAllDisabled={!activeSearch}
    editorExtensions={filterEditorExtensions}
    {filterSyntax}
    bind:filtersExpanded
    onValueChange={onQueryInput}
    onClearSearch={clearSearch}
    onClearAll={clearAll}
  >
    {#snippet actions()}
      <button
        type="button"
        class="ledger-search__action-button"
        aria-label={hasCollapsedGroups
          ? "Expand all search results"
          : "Collapse all search results"}
        title={hasCollapsedGroups
          ? "Expand all search results"
          : "Collapse all search results"}
        disabled={!hasResultGroups}
        onclick={toggleAllGroups}
      >
        {#if hasCollapsedGroups}
          <ChevronsUpDownIcon size={12} strokeWidth={1.75} />
        {:else}
          <ChevronsDownUpIcon size={12} strokeWidth={1.75} />
        {/if}
      </button>
      <FilterCommandPicker
        label="Sort"
        ariaLabel="Sort search results"
        value={searchState.sort}
        options={SORT_OPTIONS}
        placeholder="Sort search results..."
        onChange={(value) => setFacet("sort", value as LedgerSearchSort)}
      />
    {/snippet}

    {#snippet filters()}
      <div class="ledger-search__facet-row">
        <FilterCommandPicker
          multiple
          label="Type"
          values={searchState.types}
          options={TYPE_OPTIONS}
          onValuesChange={(types) => setFacet("types", types)}
        />
        <FilterCommandPicker
          multiple
          label="Account"
          values={searchState.accounts}
          options={accountOptions}
          onValuesChange={(accounts) => setFacet("accounts", accounts)}
        />
        <FilterCommandPicker
          multiple
          label="Payee"
          values={searchState.payees}
          options={payeeOptions}
          onValuesChange={(payees) => setFacet("payees", payees)}
        />
        <FilterCommandPicker
          multiple
          label="Tag"
          values={searchState.tags}
          options={tagOptions}
          onValuesChange={(tags) => setFacet("tags", tags)}
        />
        <FilterCommandPicker
          multiple
          label="Year"
          values={searchState.years}
          options={yearOptions}
          onValuesChange={(years) => setFacet("years", years)}
        />
      </div>
    {/snippet}

    {#snippet collapsedFilters()}
      <div class="ledger-search__facet-row">
        {#if searchState.types.length > 0}
          <FilterCommandPicker
            multiple
            label="Type"
            values={searchState.types}
            options={TYPE_OPTIONS}
            onValuesChange={(types) => setFacet("types", types)}
          />
        {/if}
        {#if searchState.accounts.length > 0}
          <FilterCommandPicker
            multiple
            label="Account"
            values={searchState.accounts}
            options={accountOptions}
            onValuesChange={(accounts) => setFacet("accounts", accounts)}
          />
        {/if}
        {#if searchState.payees.length > 0}
          <FilterCommandPicker
            multiple
            label="Payee"
            values={searchState.payees}
            options={payeeOptions}
            onValuesChange={(payees) => setFacet("payees", payees)}
          />
        {/if}
        {#if searchState.tags.length > 0}
          <FilterCommandPicker
            multiple
            label="Tag"
            values={searchState.tags}
            options={tagOptions}
            onValuesChange={(tags) => setFacet("tags", tags)}
          />
        {/if}
        {#if searchState.years.length > 0}
          <FilterCommandPicker
            multiple
            label="Year"
            values={searchState.years}
            options={yearOptions}
            onValuesChange={(years) => setFacet("years", years)}
          />
        {/if}
      </div>
    {/snippet}
  </SearchFilterBar>

  <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
    {#if (activeSearch || hasAmbientFilter) && totalMatches === 0}
      <p class="px-2 py-3 text-sm text-muted-foreground">
        No matching directives.
      </p>
    {:else if activeSearch || hasAmbientFilter}
      <div
        class="sticky top-0 z-10 bg-sidebar px-2 py-2 text-xs font-medium text-muted-foreground"
      >
        {totalMatches}
        {totalMatches === 1 ? "match" : "matches"}
        {#if totalMatches > RESULT_LIMIT}
          · showing first {RESULT_LIMIT}
        {/if}
      </div>
      <div class="flex flex-col gap-2" aria-label="Search results">
        {#each resultGroups as group (group.key)}
          {@const expanded = isGroupOpen(group.key)}
          <section class="flex min-w-0 flex-col gap-0.5">
            <button
              type="button"
              class="relative flex h-8 w-full min-w-0 items-center gap-1 rounded-md border border-transparent px-1 text-left text-sidebar-foreground hover:bg-background"
              aria-expanded={expanded}
              aria-label={expanded
                ? `Collapse ${group.label}`
                : `Expand ${group.label}`}
              onclick={() => toggleGroup(group.key)}
            >
              <ChevronRightIcon
                class={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  expanded && "rotate-90",
                )}
              />
              <span class="min-w-0 flex-1 truncate text-xs font-semibold"
                >{group.label}</span
              >
              <Badge
                variant="secondary"
                class="h-5 min-w-5 shrink-0 justify-center px-1.5 text-[10px] font-medium"
              >
                {group.records.length}
              </Badge>
            </button>
            {#if expanded}
              <ul class="ml-6 flex min-w-0 flex-col gap-1.5 pt-0.5">
                {#each group.records as record (record.key)}
                  <li>
                    <button
                      type="button"
                      class="w-full rounded-md border border-sidebar-border bg-background/55 p-2 text-left transition-colors hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      onclick={() => openRecord(record.key)}
                    >
                      <div
                        class="flex min-w-0 items-start justify-between gap-2"
                      >
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-xs font-semibold">
                            {record.title}
                          </div>
                          {#if record.detail && record.detail !== record.title}
                            <div
                              class="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground"
                            >
                              {record.detail}
                            </div>
                          {/if}
                        </div>
                        <Badge
                          variant="secondary"
                          class="h-5 shrink-0 px-1.5 text-[10px]"
                        >
                          {record.type}
                        </Badge>
                      </div>
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .ledger-search {
    --cv-search-filter-justify: center;
    --cv-search-filter-content-justify: center;
    --cv-search-filter-max-width: 100%;
  }

  .ledger-search :global(.cv-search-filter-bar) {
    padding-inline: 0.5rem;
  }

  .ledger-search :global(.cv-search-filter-bar__search-pill) {
    width: 100%;
    max-width: none;
  }

  .ledger-search :global(.cv-search-filter-bar__actions),
  .ledger-search :global(.cv-search-filter-bar__filters),
  .ledger-search :global(.cv-search-filter-bar__collapsed-filters),
  .ledger-search :global(.cv-search-filter-bar__query-chip) {
    justify-content: center;
  }

  .ledger-search :global(.cv-search-filter-bar__actions),
  .ledger-search :global(.cv-search-filter-bar__filters),
  .ledger-search :global(.cv-search-filter-bar__collapsed-filters) {
    width: 100%;
  }

  .ledger-search__facet-row {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  .ledger-search__action-button {
    display: inline-grid;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--background);
    color: var(--muted-foreground);
    cursor: pointer;
    padding: 0;
  }

  .ledger-search__action-button:hover,
  .ledger-search__action-button:focus-visible {
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    outline: 0;
  }

  .ledger-search__action-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
