<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    FilterCommandPicker,
    SearchFilterBar,
    type FilterCommandOption,
  } from "@beancount-js/forms";
  import type {
    ReconciliationReviewDisplayItem,
    ReconciliationReviewResponse,
  } from "../lib/reconciliation-review-response";
  import Check from "lucide-svelte/icons/check";
  import ChevronsLeft from "lucide-svelte/icons/chevrons-left";
  import ChevronsRight from "lucide-svelte/icons/chevrons-right";
  import X from "lucide-svelte/icons/x";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type { IngestionBulkReviewAction } from "../studio/ingestion-header-actions";
  import { debounceWithDelay } from "../hooks/debounce";
  import {
    appendReconciliationReviewSearchParams,
    cloneReconciliationReviewSearchState,
    collectReconciliationReviewFacetOptions,
    DEFAULT_RECONCILIATION_REVIEW_PAGE_SIZE,
    filterReconciliationReviewSearch,
    hasActiveReconciliationReviewSearch,
    normaliseReconciliationLabel,
    paginateReconciliationReviewItems,
    parseReconciliationReviewSearchState,
    reconciliationKindLabel,
    RECONCILIATION_REVIEW_PAGE_SIZES,
    type ReconciliationReviewSearchState,
  } from "../lib/reconciliation-review-search-state";
  import {
    checkboxSelectionState,
    pruneReviewSelection,
    updateReviewSelection,
  } from "../lib/review-selection";
  import { useNavigation } from "../router/router";
  import { Badge, type BadgeVariant } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import ReconciliationReviewSkeleton from "./skeletons/ReconciliationReviewSkeleton.svelte";

  type Review = ReconciliationReviewResponse;

  let {
    projectId,
    refreshKey = "",
    onApplied = () => {},
    onBulkActionChange = () => {},
  }: {
    projectId?: string;
    /** Changes after sync, edits, and ordinary acceptance to reload candidates. */
    refreshKey?: string;
    onApplied?: () => void;
    onBulkActionChange?: (
      action: IngestionBulkReviewAction | undefined,
    ) => void;
  } = $props();

  let review = $state<Review | undefined>(undefined);
  let reviewLoaded = $state(false);
  let loading = $state(false);
  let error = $state("");
  let busyCandidateId = $state("");
  let bulkConfirming = $state(false);
  let selectedCandidateIds = $state(new Set<string>());
  let loadedKey = $state("");
  let filtersExpanded = $state(false);
  let searchState = $state<ReconciliationReviewSearchState>(
    cloneReconciliationReviewSearchState(),
  );
  let lastSearchSignature = $state("");

  const { activeRoute, router } = useNavigation();
  const candidates = $derived(review?.candidates ?? []);
  const activeSearch = $derived(
    hasActiveReconciliationReviewSearch(searchState),
  );
  const facetOptions = $derived(
    collectReconciliationReviewFacetOptions(candidates),
  );
  const accountOptions = $derived<FilterCommandOption[]>(
    facetOptions.accounts.map((value) => ({ value, label: value })),
  );
  const sourceOptions = $derived<FilterCommandOption[]>(
    facetOptions.sources.map((value) => ({ value, label: value })),
  );
  const yearOptions = $derived<FilterCommandOption[]>(
    facetOptions.years.map((value) => ({ value, label: value })),
  );
  const currencyOptions = $derived<FilterCommandOption[]>(
    facetOptions.currencies.map((value) => ({ value, label: value })),
  );
  const kindOptions = $derived<FilterCommandOption[]>(
    facetOptions.kinds.map((value) => ({
      value,
      label: reconciliationKindLabel(value),
    })),
  );
  const confidenceOptions = $derived<FilterCommandOption[]>(
    facetOptions.confidence.map((value) => ({
      value,
      label: normaliseReconciliationLabel(value),
    })),
  );
  const matchedCandidates = $derived(
    filterReconciliationReviewSearch(candidates, searchState),
  );
  const pageSize = $derived(
    RECONCILIATION_REVIEW_PAGE_SIZES.includes(
      Number($activeRoute?.query?.reconcilePageSize) as 10 | 25 | 50 | 100,
    )
      ? Number($activeRoute?.query?.reconcilePageSize)
      : DEFAULT_RECONCILIATION_REVIEW_PAGE_SIZE,
  );
  const pages = $derived(
    paginateReconciliationReviewItems(matchedCandidates, pageSize),
  );
  const requestedPage = $derived(
    Math.max(1, Number($activeRoute?.query?.reconcilePage) || 1),
  );
  const page = $derived(Math.min(requestedPage, Math.max(1, pages.length)));
  const visibleCandidates = $derived(pages[page - 1] ?? []);
  const actionableCandidates = $derived(
    matchedCandidates.filter(canBulkConfirm),
  );
  const actionableCandidateIds = $derived(
    new Set(actionableCandidates.map((item) => item.candidate.id)),
  );
  const selectedCandidates = $derived(
    actionableCandidates.filter((item) =>
      selectedCandidateIds.has(item.candidate.id),
    ),
  );
  const visibleActionableCandidateIds = $derived(
    visibleCandidates
      .filter((item) => actionableCandidateIds.has(item.candidate.id))
      .map((item) => item.candidate.id),
  );
  const masterSelection = $derived(
    checkboxSelectionState(selectedCandidateIds, visibleActionableCandidateIds),
  );
  const allMatchingSelected = $derived(
    actionableCandidates.length > 0 &&
      selectedCandidateIds.size === actionableCandidates.length,
  );
  const showSelectionBanner = $derived(
    actionableCandidates.length > visibleActionableCandidateIds.length &&
      visibleActionableCandidateIds.length > 0 &&
      (masterSelection.checked || allMatchingSelected),
  );
  const bulkAction = $derived.by((): IngestionBulkReviewAction | undefined => {
    if (!selectedCandidates.length) return;
    return {
      label: "Confirm",
      selectedCount: selectedCandidates.length,
      canRun:
        !loading && !bulkConfirming && !busyCandidateId && Boolean(projectId),
      busy: bulkConfirming,
      onRun: () => void confirmSelectedCandidates(),
    };
  });

  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
  }

  function canBulkConfirm(item: ReconciliationReviewDisplayItem) {
    return (
      item.decision?.state !== "confirmed" &&
      Boolean(
        item.decision?.canonicalObservationId ??
          item.candidate.recommendedCanonicalId,
      )
    );
  }

  function setSelectedCandidates(
    candidateIds: readonly string[],
    selected: boolean,
  ) {
    selectedCandidateIds = updateReviewSelection(
      selectedCandidateIds,
      candidateIds,
      selected,
    );
  }

  function selectAllMatchingCandidates() {
    selectedCandidateIds = new Set(
      actionableCandidates.map((item) => item.candidate.id),
    );
  }

  function clearSelectedCandidates() {
    selectedCandidateIds = new Set();
  }

  function memberLabel(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    const observation = member.observation;
    return (
      observation.merchant ??
      observation.payee ??
      observation.narration ??
      observation.sourceAccount
    );
  }

  function memberInitial(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    return memberLabel(member).slice(0, 1).toUpperCase() || "?";
  }

  function memberDetail(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    const observation = member.observation;
    return [observation.sourceAccount, observation.bookedAt].join(" · ");
  }

  function memberSourceLabel(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    const observation = member.observation;
    if (observation.origin === "ledger") return "Ledger";
    return normaliseReconciliationLabel(
      observation.sourceId?.split(":", 1)[0] ?? "Incoming",
    );
  }

  function confidenceBadgeVariant(confidence: string): BadgeVariant {
    if (confidence === "high") return "success";
    if (confidence === "possible") return "warning";
    return "secondary";
  }

  function updateRoute(values: Record<string, string | undefined>) {
    const query = new URLSearchParams($activeRoute?.query ?? {});
    for (const [key, value] of Object.entries(values)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const next = query.toString();
    router.updateState(next ? `?${next}` : "?");
  }

  function searchSignature(query: Record<string, string>) {
    const params = new URLSearchParams(query);
    return [
      params.get("reconcileQ") ?? "",
      params.get("reconcileAccounts") ?? "",
      params.get("reconcileSources") ?? "",
      params.get("reconcileYears") ?? "",
      params.get("reconcileCurrency") ?? "",
      params.get("reconcileKinds") ?? "",
      params.get("reconcileConfidence") ?? "",
    ].join("\0");
  }

  function applySearchState(
    next: ReconciliationReviewSearchState,
    resetPage = true,
  ) {
    searchState = cloneReconciliationReviewSearchState(next);
    const params = new URLSearchParams($activeRoute?.query ?? {});
    appendReconciliationReviewSearchParams(params, next);
    if (resetPage) params.set("reconcilePage", "1");
    lastSearchSignature = searchSignature(Object.fromEntries(params));
    const search = params.toString();
    router.updateState(search ? `?${search}` : "?");
  }

  const [scheduleSearchSync, delaySearchSync] = debounceWithDelay(
    (next: ReconciliationReviewSearchState) => applySearchState(next),
    250,
  );

  function onSearchQueryInput(value: string) {
    searchState = { ...searchState, query: value };
    scheduleSearchSync(searchState);
    delaySearchSync();
  }

  function setSearchFacet<K extends keyof ReconciliationReviewSearchState>(
    key: K,
    value: ReconciliationReviewSearchState[K],
  ) {
    applySearchState({ ...searchState, [key]: value });
  }

  function clearSearchQuery() {
    applySearchState({ ...searchState, query: "" });
  }

  function clearAllSearch() {
    applySearchState(cloneReconciliationReviewSearchState());
  }

  async function load() {
    if (!projectId) {
      review = undefined;
      reviewLoaded = false;
      loading = false;
      return;
    }
    error = "";
    loading = true;
    try {
      review = await ingestionJson<Review>(
        ingestionPath(projectId, "/reconciliation"),
      );
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      reviewLoaded = true;
      loading = false;
    }
  }

  async function decide(
    item: ReconciliationReviewDisplayItem,
    state: "confirmed" | "dismissed",
    canonicalObservationId?: string,
  ) {
    if (!projectId || busyCandidateId || bulkConfirming) return;
    busyCandidateId = item.candidate.id;
    try {
      review = await ingestionJson<Review>(
        ingestionPath(projectId, "/reconciliation"),
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            candidateId: item.candidate.id,
            state,
            canonicalObservationId,
          }),
        },
      );
      error = "";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busyCandidateId = "";
    }
  }

  async function apply(item: ReconciliationReviewDisplayItem) {
    if (!projectId || busyCandidateId || bulkConfirming) return;
    busyCandidateId = item.candidate.id;
    try {
      await ingestionJson(
        ingestionPath(
          projectId,
          `/reconciliation/${encodeURIComponent(item.candidate.id)}/apply`,
        ),
        { method: "POST" },
      );
      await load();
      onApplied();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busyCandidateId = "";
    }
  }

  async function confirmSelectedCandidates() {
    if (!projectId || bulkConfirming || !selectedCandidates.length) return;
    const items = [...selectedCandidates];
    bulkConfirming = true;
    error = "";
    let confirmedCount = 0;
    try {
      for (const item of items) {
        const canonicalObservationId =
          item.decision?.canonicalObservationId ??
          item.candidate.recommendedCanonicalId;
        if (!canonicalObservationId) continue;
        review = await ingestionJson<Review>(
          ingestionPath(projectId, "/reconciliation"),
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              candidateId: item.candidate.id,
              state: "confirmed",
              canonicalObservationId,
            }),
          },
        );
        selectedCandidateIds = updateReviewSelection(
          selectedCandidateIds,
          [item.candidate.id],
          false,
        );
        confirmedCount += 1;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      error = confirmedCount
        ? `Confirmed ${confirmedCount} match${confirmedCount === 1 ? "" : "es"}; ${message}`
        : message;
    } finally {
      bulkConfirming = false;
    }
  }

  $effect(() => {
    const key = `${projectId ?? ""}\0${refreshKey}`;
    if (key === loadedKey) return;
    loadedKey = key;
    void load();
  });

  $effect(() => {
    const signature = searchSignature($activeRoute?.query ?? {});
    if (signature === lastSearchSignature) return;
    lastSearchSignature = signature;
    searchState = parseReconciliationReviewSearchState(
      $activeRoute?.query ?? {},
    );
  });

  $effect(() => {
    const next = pruneReviewSelection(
      selectedCandidateIds,
      actionableCandidateIds,
    );
    if (
      next.size !== selectedCandidateIds.size ||
      [...next].some((key) => !selectedCandidateIds.has(key))
    ) {
      selectedCandidateIds = next;
    }
  });

  $effect(() => {
    onBulkActionChange(bulkAction);
  });

  onDestroy(() => {
    onBulkActionChange(undefined);
  });
</script>

{#if loading && !reviewLoaded}
  <ReconciliationReviewSkeleton />
{:else if candidates.length}
  <div
    class="ingestion-page-search"
    style="--cv-search-filter-justify: stretch; --cv-search-filter-content-justify: stretch; --cv-search-filter-max-width: 100%;"
  >
    <SearchFilterBar
      inputMode="plain"
      value={searchState.query}
      placeholder="Search reconciliation matches…"
      ariaLabel="Search reconciliation matches"
      clearSearchLabel="Clear search"
      clearAllLabel="Clear all filters"
      expandFiltersLabel="Expand filter options"
      collapseFiltersLabel="Collapse filter options"
      showActiveQueryChip={true}
      showFilterToggle={true}
      showClearAll={activeSearch}
      clearAllDisabled={!activeSearch}
      bind:filtersExpanded
      onValueChange={onSearchQueryInput}
      onClearSearch={clearSearchQuery}
      onClearAll={clearAllSearch}
    >
      {#snippet filters()}
        <div class="ingestion-page-search__facet-row">
          <FilterCommandPicker
            multiple
            label="Account"
            values={searchState.accounts}
            options={accountOptions}
            placeholder="Filter by account…"
            onValuesChange={(accounts) => setSearchFacet("accounts", accounts)}
          />
          <FilterCommandPicker
            multiple
            label="Source"
            values={searchState.sources}
            options={sourceOptions}
            placeholder="Filter by source…"
            onValuesChange={(sources) => setSearchFacet("sources", sources)}
          />
          <FilterCommandPicker
            multiple
            label="Reason"
            values={searchState.kinds}
            options={kindOptions}
            placeholder="Filter by reason…"
            onValuesChange={(kinds) => setSearchFacet("kinds", kinds)}
          />
          <FilterCommandPicker
            multiple
            label="Confidence"
            values={searchState.confidence}
            options={confidenceOptions}
            placeholder="Filter by confidence…"
            onValuesChange={(confidence) =>
              setSearchFacet("confidence", confidence)}
          />
          <FilterCommandPicker
            multiple
            label="Year"
            values={searchState.years}
            options={yearOptions}
            placeholder="Filter by year…"
            onValuesChange={(years) => setSearchFacet("years", years)}
          />
          <FilterCommandPicker
            multiple
            label="Currency"
            values={searchState.currencies}
            options={currencyOptions}
            placeholder="Filter by currency…"
            onValuesChange={(currencies) =>
              setSearchFacet("currencies", currencies)}
          />
        </div>
      {/snippet}
      {#snippet collapsedFilters()}
        <div class="ingestion-page-search__facet-row">
          {#if searchState.accounts.length}
            <FilterCommandPicker
              multiple
              label="Account"
              values={searchState.accounts}
              options={accountOptions}
              onValuesChange={(accounts) =>
                setSearchFacet("accounts", accounts)}
            />
          {/if}
          {#if searchState.sources.length}
            <FilterCommandPicker
              multiple
              label="Source"
              values={searchState.sources}
              options={sourceOptions}
              onValuesChange={(sources) => setSearchFacet("sources", sources)}
            />
          {/if}
          {#if searchState.kinds.length}
            <FilterCommandPicker
              multiple
              label="Reason"
              values={searchState.kinds}
              options={kindOptions}
              onValuesChange={(kinds) => setSearchFacet("kinds", kinds)}
            />
          {/if}
          {#if searchState.confidence.length}
            <FilterCommandPicker
              multiple
              label="Confidence"
              values={searchState.confidence}
              options={confidenceOptions}
              onValuesChange={(confidence) =>
                setSearchFacet("confidence", confidence)}
            />
          {/if}
          {#if searchState.years.length}
            <FilterCommandPicker
              multiple
              label="Year"
              values={searchState.years}
              options={yearOptions}
              onValuesChange={(years) => setSearchFacet("years", years)}
            />
          {/if}
          {#if searchState.currencies.length}
            <FilterCommandPicker
              multiple
              label="Currency"
              values={searchState.currencies}
              options={currencyOptions}
              onValuesChange={(currencies) =>
                setSearchFacet("currencies", currencies)}
            />
          {/if}
        </div>
      {/snippet}
    </SearchFilterBar>
  </div>

  {#if activeSearch && !matchedCandidates.length}
    <div
      class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
    >
      No reconciliation matches this search.
    </div>
  {:else if matchedCandidates.length}
    <div
      class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
    >
      <input
        use:setIndeterminate={masterSelection.indeterminate}
        type="checkbox"
        class="size-4 rounded border-input text-primary focus:ring-ring"
        aria-label="Select visible reconciliation matches"
        checked={masterSelection.checked}
        disabled={!visibleActionableCandidateIds.length || bulkConfirming}
        onchange={(event) =>
          setSelectedCandidates(
            visibleActionableCandidateIds,
            (event.currentTarget as HTMLInputElement).checked,
          )}
      />
      <span>Match</span>
      <span class="text-right">Actions</span>
    </div>

    {#if showSelectionBanner}
      <div
        data-reconciliation-selection-banner
        role="status"
        class="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
      >
        {#if allMatchingSelected}
          All {actionableCandidates.length} matching reconciliation items selected.
          <button
            type="button"
            class="font-medium text-primary underline-offset-2 hover:underline"
            onclick={clearSelectedCandidates}
          >
            Clear selection
          </button>
        {:else}
          All {visibleActionableCandidateIds.length} actionable matches on this page
          are selected.
          <button
            type="button"
            class="font-medium text-primary underline-offset-2 hover:underline"
            onclick={selectAllMatchingCandidates}
          >
            Select all {actionableCandidates.length} matching items
          </button>
        {/if}
      </div>
    {/if}

    <div class="flex flex-col gap-3" data-ingestion-reconciliation>
      {#each visibleCandidates as item (item.candidate.id)}
        {@const busy = busyCandidateId === item.candidate.id}
        {@const selectable = actionableCandidateIds.has(item.candidate.id)}
        {@const chosen =
          item.decision?.canonicalObservationId ??
          item.candidate.recommendedCanonicalId}
        <section class="overflow-hidden rounded-2xl bg-muted/80">
          <div
            class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-4 sm:px-5"
          >
            <input
              type="checkbox"
              class="mt-0.5 size-4 rounded border-input text-primary focus:ring-ring"
              aria-label={`Select ${reconciliationKindLabel(item.candidate.kind)}`}
              title={selectable
                ? undefined
                : item.decision?.state === "confirmed"
                  ? "This match is already confirmed"
                  : "Choose a canonical record before confirming this match"}
              checked={selectedCandidateIds.has(item.candidate.id)}
              disabled={!selectable || bulkConfirming}
              onchange={(event) =>
                setSelectedCandidates(
                  [item.candidate.id],
                  (event.currentTarget as HTMLInputElement).checked,
                )}
            />
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2
                  class="text-sm font-semibold tracking-[0.08em] text-muted-foreground [font-variant:all-small-caps]"
                  data-reconciliation-kind
                >
                  {reconciliationKindLabel(item.candidate.kind)}
                </h2>
                <Badge
                  variant={confidenceBadgeVariant(item.candidate.confidence)}
                  class="rounded-full"
                  data-reconciliation-confidence={item.candidate.confidence}
                  >{normaliseReconciliationLabel(
                    item.candidate.confidence,
                  )}</Badge
                >
              </div>
            </div>
            <div
              class="flex shrink-0 flex-wrap items-center justify-end gap-1"
              data-reconciliation-actions
            >
              {#if item.decision?.state === "confirmed"}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Apply confirmed match"
                  title="Apply confirmed match"
                  data-reconciliation-action="apply"
                  disabled={busy || bulkConfirming}
                  onclick={() => void apply(item)}
                >
                  <Check data-icon />
                </Button>
              {:else}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Not a match"
                  title="Not a match"
                  data-reconciliation-action="dismiss"
                  disabled={busy || bulkConfirming}
                  onclick={() => void decide(item, "dismissed")}
                >
                  <X data-icon />
                </Button>
                {#if chosen}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Confirm match"
                    title="Confirm match"
                    data-reconciliation-action="confirm"
                    disabled={busy || bulkConfirming}
                    onclick={() => void decide(item, "confirmed", chosen)}
                  >
                    <Check data-icon />
                  </Button>
                {:else}
                  {#each item.members as member (member.observation.id)}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Use ${memberLabel(member)} as the canonical record`}
                      title={`Use ${memberLabel(member)} as the canonical record`}
                      data-reconciliation-action="confirm"
                      disabled={busy || bulkConfirming}
                      onclick={() =>
                        void decide(item, "confirmed", member.observation.id)}
                    >
                      <Check data-icon />
                    </Button>
                  {/each}
                {/if}
              {/if}
            </div>
            <p
              class="col-span-full text-xs leading-relaxed text-muted-foreground"
            >
              {item.candidate.evidence
                .map((evidence) => evidence.summary)
                .join(" · ")}
            </p>
          </div>

          <div
            class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            {#each item.members as member, memberIndex (member.observation.id)}
              <div
                class:rounded-b-xl={memberIndex === item.members.length - 1}
                class="relative grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b px-[15px] py-4 last:border-b-0 sm:grid-cols-[7rem_2.5rem_minmax(0,1fr)]"
                data-reconciliation-member-row
              >
                <span
                  class="col-start-2 row-start-2 text-sm font-semibold tabular-nums sm:col-start-1 sm:row-start-1 sm:justify-self-end"
                  data-reconciliation-member-amount
                >
                  {member.observation.amount}&nbsp;{member.observation.currency}
                </span>
                <div
                  class="col-start-1 row-span-2 row-start-1 flex size-10 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground sm:col-start-2 sm:row-span-1"
                  aria-hidden="true"
                  data-reconciliation-member-avatar
                >
                  {memberInitial(member)}
                </div>
                <div
                  class="col-start-2 row-start-1 min-w-0 pr-24 sm:col-start-3"
                  data-reconciliation-member-details
                >
                  <div class="break-words text-sm font-semibold sm:truncate">
                    {memberLabel(member)}
                  </div>
                  <div
                    class="mt-1 break-words text-xs text-muted-foreground sm:truncate"
                  >
                    {memberDetail(member)}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  class="pointer-events-none absolute right-3 top-2 rounded-full bg-card text-[10px] uppercase tracking-wide text-muted-foreground"
                  aria-label={`Source ${memberSourceLabel(member)}`}
                  data-reconciliation-member-source
                >
                  {memberSourceLabel(member)}
                </Badge>
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>

    {#if pages.length > 1}
      <nav
        class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        aria-label="Reconciliation match pages"
      >
        <span class="text-sm text-muted-foreground"
          >Page {page} of {pages.length}</span
        >
        <div
          class="flex flex-wrap items-center justify-between gap-2 sm:justify-end"
        >
          <div class="hidden items-center gap-2 sm:flex">
            <label
              class="text-sm text-muted-foreground"
              for="reconciliation-review-page-size">Matches per page</label
            >
            <select
              id="reconciliation-review-page-size"
              class="h-8 rounded-md border bg-background px-2 text-sm"
              value={pageSize}
              onchange={(event) =>
                updateRoute({
                  reconcilePageSize: (event.currentTarget as HTMLSelectElement)
                    .value,
                  reconcilePage: "1",
                })}
            >
              {#each RECONCILIATION_REVIEW_PAGE_SIZES as size (size)}
                <option value={size}>{size}</option>
              {/each}
            </select>
          </div>
          <Button
            size="icon"
            variant="outline"
            aria-label="Previous reconciliation page"
            disabled={page <= 1}
            onclick={() =>
              updateRoute({ reconcilePage: String(Math.max(1, page - 1)) })}
          >
            <ChevronsLeft data-icon />
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Next reconciliation page"
            disabled={page >= pages.length}
            onclick={() => updateRoute({ reconcilePage: String(page + 1) })}
          >
            <ChevronsRight data-icon />
          </Button>
        </div>
      </nav>
    {/if}
  {/if}
{:else if reviewLoaded && !error}
  <div
    class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
  >
    No reconciliation matches are available.
  </div>
{:else if error}
  <p class="text-sm text-destructive" role="status">{error}</p>
{/if}

<style>
  .ingestion-page-search :global(.cv-search-filter-bar) {
    padding: 0;
  }

  .ingestion-page-search :global(.cv-search-filter-bar__search-pill) {
    flex: 1 1 100%;
    width: 100%;
    max-width: none;
  }

  .ingestion-page-search__facet-row {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }
</style>
