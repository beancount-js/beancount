<script lang="ts">
  import { syntaxHighlighting } from "@codemirror/language";
  import { type Extension } from "@codemirror/state";
  import type { Snippet } from "svelte";
  import ChevronRightIcon from "lucide-svelte/icons/chevron-right";
  import ChevronsDownUpIcon from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDownIcon from "lucide-svelte/icons/chevrons-up-down";
  import {
    SearchFilterBar,
    type FilterCommandOption,
    FilterCommandPicker,
  } from "../forms";
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

  const highlightStyle = syntaxHighlighting(codeHighlighter, {
    fallback: true,
  });
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

<div class="cn-pages-search-121-1 ledger-search">
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
    {onValueChange}
    {onClearSearch}
    {onClearAll}
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

  <div class="cn-pages-search-278-1">
    {#if (activeSearch || hasAmbientFilter) && totalMatches === 0}
      <p class="cn-pages-search-280-1">No matching directives.</p>
    {:else if activeSearch || hasAmbientFilter}
      <div class="cn-pages-search-285-1">
        {totalMatches}
        {totalMatches === 1 ? "match" : "matches"}
        {#if totalMatches > resultLimit}
          · showing first {resultLimit}
        {/if}
      </div>
      <div class="cn-pages-search-293-1" aria-label="Search results">
        {#each resultGroups as group (group.key)}
          {@const expanded = isGroupOpen(group.key)}
          <section class="cn-pages-search-296-1">
            <button
              type="button"
              class="cn-pages-search-299-1"
              aria-expanded={expanded}
              aria-label={expanded
                ? `Collapse ${group.label}`
                : `Expand ${group.label}`}
              onclick={() => toggleGroup(group.key)}
            >
              <ChevronRightIcon
                class={cn(
                  "cn-pages-search-308-1",
                  expanded && "cn-pages-search-309-1",
                )}
              />
              <span class="cn-pages-search-312-1">{group.label}</span>
              <Badge variant="secondary" class="cn-pages-search-317-1">
                {group.records.length}
              </Badge>
            </button>
            {#if expanded}
              <ul class="cn-pages-search-323-1">
                {#each group.records as record (record.key)}
                  <li>
                    <button
                      type="button"
                      class="cn-pages-search-328-1"
                      onclick={() => onOpenRecord(record.key)}
                    >
                      <div class="cn-pages-search-332-1">
                        <div class="cn-pages-search-334-1">
                          <div class="cn-pages-search-335-1">
                            {record.title}
                          </div>
                          {#if record.detail && record.detail !== record.title}
                            <div class="cn-pages-search-340-1">
                              {record.detail}
                            </div>
                          {/if}
                        </div>
                        <Badge
                          variant="secondary"
                          class="cn-pages-search-348-1"
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
