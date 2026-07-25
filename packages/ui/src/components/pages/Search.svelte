<script lang="ts">
  import { syntaxHighlighting } from "@codemirror/language";
  import { type Extension } from "@codemirror/state";
  import type { Snippet } from "svelte";
  import ChevronRightIcon from "lucide-svelte/icons/chevron-right";
  import ChevronsDownUpIcon from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDownIcon from "lucide-svelte/icons/chevrons-up-down";
  import { SearchFilterBar, type FilterCommandOption, FilterCommandPicker } from "../forms";
  import { cn } from "../../lib/utils";
  import { Badge } from "../shadcn/badge";
  import { codeHighlighter } from "../forms/code-highlighter";

  export type SearchSort = "relevance" | "dateDesc" | "dateAsc" | "title";

  export type SearchState = {
    query: string;
    sort: SearchSort;
    types: readonly string[];
    accounts: readonly string[];
    payees: readonly string[];
    tags: readonly string[];
    years: readonly string[];
  };

  export type SearchResultRecord = {
    key: string;
    title: string;
    detail: string;
    type: string;
  };

  export type SearchResultGroup = {
    key: string;
    label: string;
    records: readonly SearchResultRecord[];
  };

  let {
    searchState,
    filtersExpanded = $bindable(false),
    typeOptions,
    accountOptions,
    payeeOptions,
    tagOptions,
    yearOptions,
    resultGroups = [],
    activeSearch = false,
    hasAmbientFilter = false,
    totalMatches = 0,
    resultLimit = 50,
    onValueChange = () => {},
    onClearSearch = () => {},
    onClearAll = () => {},
    onSortChange = () => {},
    onTypesChange = () => {},
    onAccountsChange = () => {},
    onPayeesChange = () => {},
    onTagsChange = () => {},
    onYearsChange = () => {},
    onOpenRecord,
    editorExtensions,
    filterSyntax,
    actions,
    filters,
    collapsedFilters,
  }: {
    searchState: SearchState;
    filtersExpanded?: boolean;
    typeOptions: readonly FilterCommandOption[];
    accountOptions: readonly FilterCommandOption[];
    payeeOptions: readonly FilterCommandOption[];
    tagOptions: readonly FilterCommandOption[];
    yearOptions: readonly FilterCommandOption[];
    resultGroups: readonly SearchResultGroup[];
    activeSearch?: boolean;
    hasAmbientFilter?: boolean;
    totalMatches?: number;
    resultLimit?: number;
    onValueChange?: (value: string) => void;
    onClearSearch?: () => void;
    onClearAll?: () => void;
    onSortChange?: (value: SearchSort) => void;
    onTypesChange?: (values: string[]) => void;
    onAccountsChange?: (values: string[]) => void;
    onPayeesChange?: (values: string[]) => void;
    onTagsChange?: (values: string[]) => void;
    onYearsChange?: (values: string[]) => void;
    onOpenRecord: (key: string) => void;
    editorExtensions?: readonly Extension[];
    filterSyntax?: unknown;
    actions?: Snippet;
    filters?: Snippet;
    collapsedFilters?: Snippet;
  } = $props();

  let openGroups = $state<Record<string, boolean>>({});

  const highlightStyle = syntaxHighlighting(codeHighlighter, { fallback: true });
  const hasResultGroups = $derived(resultGroups.length > 0);
  const hasCollapsedGroups = $derived(
    resultGroups.some((group) => !(openGroups[group.key] ?? true)),
  );

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
    editorExtensions={[highlightStyle, ...(editorExtensions ?? [])]}
    {filterSyntax}
    bind:filtersExpanded
    onValueChange={onValueChange}
    onClearSearch={onClearSearch}
    onClearAll={onClearAll}
  >
    {#if actions}
      {@render actions()}
    {:else}
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
          options={[
            { value: "relevance", label: "Best match" },
            { value: "dateDesc", label: "Newest first" },
            { value: "dateAsc", label: "Oldest first" },
            { value: "title", label: "Title (A to Z)" },
          ]}
          placeholder="Sort search results..."
          onChange={(value) => onSortChange(value as SearchSort)}
        />
      {/snippet}
    {/if}

    {#if filters}
      {@render filters()}
    {:else}
      {#snippet filters()}
        <div class="ledger-search__facet-row">
          <FilterCommandPicker
            multiple
            label="Type"
            values={searchState.types}
            options={typeOptions}
            onValuesChange={onTypesChange}
          />
          <FilterCommandPicker
            multiple
            label="Account"
            values={searchState.accounts}
            options={accountOptions}
            onValuesChange={onAccountsChange}
          />
          <FilterCommandPicker
            multiple
            label="Payee"
            values={searchState.payees}
            options={payeeOptions}
            onValuesChange={onPayeesChange}
          />
          <FilterCommandPicker
            multiple
            label="Tag"
            values={searchState.tags}
            options={tagOptions}
            onValuesChange={onTagsChange}
          />
          <FilterCommandPicker
            multiple
            label="Year"
            values={searchState.years}
            options={yearOptions}
            onValuesChange={onYearsChange}
          />
        </div>
      {/snippet}
    {/if}

    {#if collapsedFilters}
      {@render collapsedFilters()}
    {:else}
      {#snippet collapsedFilters()}
        <div class="ledger-search__facet-row">
          {#if searchState.types.length > 0}
            <FilterCommandPicker
              multiple
              label="Type"
              values={searchState.types}
              options={typeOptions}
              onValuesChange={onTypesChange}
            />
          {/if}
          {#if searchState.accounts.length > 0}
            <FilterCommandPicker
              multiple
              label="Account"
              values={searchState.accounts}
              options={accountOptions}
              onValuesChange={onAccountsChange}
            />
          {/if}
          {#if searchState.payees.length > 0}
            <FilterCommandPicker
              multiple
              label="Payee"
              values={searchState.payees}
              options={payeeOptions}
              onValuesChange={onPayeesChange}
            />
          {/if}
          {#if searchState.tags.length > 0}
            <FilterCommandPicker
              multiple
              label="Tag"
              values={searchState.tags}
              options={tagOptions}
              onValuesChange={onTagsChange}
            />
          {/if}
          {#if searchState.years.length > 0}
            <FilterCommandPicker
              multiple
              label="Year"
              values={searchState.years}
              options={yearOptions}
              onValuesChange={onYearsChange}
            />
          {/if}
        </div>
      {/snippet}
    {/if}
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
        {#if totalMatches > resultLimit}
          · showing first {resultLimit}
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
                      onclick={() => onOpenRecord(record.key)}
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
