<script lang="ts">
  import { accountOpenClose } from "@beancount-js/beancount";
  import { onDestroy } from "svelte";
  import type { FilterCommandOption } from "@lapis/ui/forms";
  import SharedIngestionReconciliationPanel, {
    type ReconciliationPanelItem,
    type ReconciliationPanelMember,
    type ReconciliationReviewFacetOptions,
    type ReconciliationReviewSearchValues,
  } from "@lapis/ui/pages/IngestionReconciliationPanel.svelte";
  import type {
    ReconciliationReviewDisplayItem,
    ReconciliationReviewResponse,
  } from "../lib/reconciliation-review-response";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type { IngestionSource } from "../ingestion/types";
  import { useContext } from "../context";
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
  import type { BadgeVariant } from "@lapis/ui/shadcn/badge";

  type Review = ReconciliationReviewResponse;
  type ConnectionMerchant = {
    merchantId: string;
    logoUrl?: string;
  };

  let {
    projectId,
    sources = [],
    refreshKey = "",
    onApplied = () => {},
    onReconciliationChanged = () => {},
    onBulkActionChange = () => {},
  }: {
    projectId?: string;
    sources?: readonly IngestionSource[];
    refreshKey?: string;
    onApplied?: () => void;
    onReconciliationChanged?: () => void;
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
  let autoConfirming = $state(false);
  let rechecking = $state(false);
  let selectedCandidateIds = $state(new Set<string>());
  let merchantsById = $state<Record<string, ConnectionMerchant>>({});
  let loadedMerchantsProjectId = $state("");
  let loadedKey = $state("");
  let searchState = $state<ReconciliationReviewSearchState>(
    cloneReconciliationReviewSearchState(),
  );
  let lastSearchSignature = $state("");

  const { activeRoute, router } = useNavigation();
  const { ledgerData } = useContext();
  const candidates = $derived(review?.candidates ?? []);
  const openDirectivesByAccount = $derived.by(() =>
    accountOpenClose($ledgerData.directives),
  );
  const sourcesById = $derived(
    new Map(sources.map((source) => [source.id, source])),
  );
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
      busyLabel: rechecking ? "Re-running checks" : undefined,
      selectedCount: selectedCandidates.length,
      canRun:
        !loading &&
        !bulkConfirming &&
        !autoConfirming &&
        !rechecking &&
        !busyCandidateId &&
        Boolean(projectId),
      busy: bulkConfirming || rechecking,
      onRun: () => void confirmSelectedCandidates(),
      additionalActions: [
        {
          label: "Re-run selected checks",
          disabled: rechecking || autoConfirming,
          onRun: () => void recheckSelectedCandidates(),
        },
      ],
    };
  });
  const searchValues = $derived<ReconciliationReviewSearchValues>({
    query: searchState.query,
    accounts: searchState.accounts,
    sources: searchState.sources,
    years: searchState.years,
    currencies: searchState.currencies,
    kinds: searchState.kinds,
    confidence: searchState.confidence,
  });
  const reviewFacetOptions = $derived<ReconciliationReviewFacetOptions>({
    accounts: accountOptions,
    sources: sourceOptions,
    years: yearOptions,
    currencies: currencyOptions,
    kinds: kindOptions,
    confidence: confidenceOptions,
  });
  const visiblePanelItems = $derived(
    visibleCandidates.map((item) => reconciliationPanelItem(item)),
  );

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

  function memberDetail(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    const observation = member.observation;
    return [observation.sourceAccount, observation.bookedAt].join(" · ");
  }

  function connectionForMember(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    const connectionId = member.observation.sourceId?.split(":", 1)[0];
    return connectionId ? sourcesById.get(connectionId) : undefined;
  }

  function merchantFor(merchantId?: string) {
    return merchantId ? merchantsById[merchantId] : undefined;
  }

  function accountAppearanceFor(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    const sourceAccount = member.observation.sourceAccount;
    const open = sourceAccount
      ? openDirectivesByAccount[sourceAccount]?.open
      : undefined;
    return {
      color: typeof open?.meta.color === "string" ? open.meta.color : "",
      icon: typeof open?.meta.icon === "string" ? open.meta.icon : "",
      merchantId:
        typeof open?.meta.merchant_id === "string"
          ? open.meta.merchant_id
          : undefined,
    };
  }

  function sourceMerchantFor(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    return merchantFor(connectionForMember(member)?.merchantId);
  }

  function memberSourceLabel(
    member: ReconciliationReviewDisplayItem["members"][number],
  ) {
    const observation = member.observation;
    if (observation.origin === "ledger") return "Ledger";
    const connection = connectionForMember(member);
    if (connection) return connection.name;
    return normaliseReconciliationLabel(
      observation.sourceId?.split(":", 1)[0] ?? "Incoming",
    );
  }

  function confidenceBadgeVariant(confidence: string): BadgeVariant {
    if (confidence === "high") return "success";
    if (confidence === "possible") return "warning";
    return "secondary";
  }

  function panelMember(
    member: ReconciliationReviewDisplayItem["members"][number],
  ): ReconciliationPanelMember {
    const appearance = accountAppearanceFor(member);
    const accountMerchant = merchantFor(appearance.merchantId);
    const sourceMerchant = sourceMerchantFor(member);
    return {
      observationId: member.observation.id,
      label: memberLabel(member),
      detail: memberDetail(member),
      account: member.observation.sourceAccount,
      color: appearance.color,
      icon: appearance.icon,
      accountMerchantLogoUrl: accountMerchant?.logoUrl,
      sourceLabel: memberSourceLabel(member),
      sourceMerchantId: sourceMerchant?.merchantId,
      sourceMerchantLogoUrl: sourceMerchant?.logoUrl,
      amount: member.observation.amount,
      currency: member.observation.currency,
    };
  }

  function reconciliationPanelItem(
    item: ReconciliationReviewDisplayItem,
  ): ReconciliationPanelItem {
    const chosenObservationId =
      item.decision?.canonicalObservationId ??
      item.candidate.recommendedCanonicalId;
    return {
      id: item.candidate.id,
      kind: item.candidate.kind,
      kindLabel: reconciliationKindLabel(item.candidate.kind),
      confidence: item.candidate.confidence,
      confidenceLabel: normaliseReconciliationLabel(item.candidate.confidence),
      confidenceVariant: confidenceBadgeVariant(item.candidate.confidence),
      evidenceSummary: item.candidate.evidence
        .map((evidence) => evidence.summary)
        .join(" · "),
      decisionState: item.decision?.state,
      chosenObservationId,
      selectable: canBulkConfirm(item),
      selectableTitle: canBulkConfirm(item)
        ? undefined
        : item.decision?.state === "confirmed"
          ? "This match is already confirmed"
          : "Choose a canonical record before confirming this match",
      members: item.members.map(panelMember),
    };
  }

  function itemFor(candidateId: string) {
    return candidates.find((item) => item.candidate.id === candidateId);
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

  async function loadMerchants(nextProjectId: string) {
    try {
      const merchants = await ingestionJson<ConnectionMerchant[]>(
        ingestionPath(nextProjectId, "/merchants"),
      );
      if (projectId !== nextProjectId) return;
      merchantsById = Object.fromEntries(
        merchants.map((merchant) => [merchant.merchantId, merchant]),
      );
    } catch {
      if (projectId === nextProjectId) merchantsById = {};
    }
  }

  async function decide(
    item: ReconciliationReviewDisplayItem,
    state: "confirmed" | "dismissed",
    canonicalObservationId?: string,
  ) {
    if (
      !projectId ||
      busyCandidateId ||
      bulkConfirming ||
      autoConfirming ||
      rechecking
    ) {
      return;
    }
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
      onReconciliationChanged();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      busyCandidateId = "";
    }
  }

  async function apply(item: ReconciliationReviewDisplayItem) {
    if (
      !projectId ||
      busyCandidateId ||
      bulkConfirming ||
      autoConfirming ||
      rechecking
    ) {
      return;
    }
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
    if (
      !projectId ||
      bulkConfirming ||
      autoConfirming ||
      rechecking ||
      !selectedCandidates.length
    ) {
      return;
    }
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
      if (confirmedCount) onReconciliationChanged();
    }
  }

  async function autoConfirmExactMappedMatches() {
    if (!projectId || autoConfirming || bulkConfirming || rechecking) return;
    autoConfirming = true;
    error = "";
    try {
      const response = await ingestionJson<{
        confirmedCandidateIds: string[];
        review: Review;
      }>(ingestionPath(projectId, "/reconciliation"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "auto-confirm" }),
      });
      review = response.review;
      onReconciliationChanged();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      autoConfirming = false;
    }
  }

  async function recheckSelectedCandidates() {
    if (!projectId || rechecking || !selectedCandidates.length) return;
    rechecking = true;
    error = "";
    try {
      const response = await ingestionJson<{
        updatedProposalCount: number;
        review: Review;
      }>(ingestionPath(projectId, "/reconciliation"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "incremental-recheck",
          candidateIds: selectedCandidates.map((item) => item.candidate.id),
        }),
      });
      review = response.review;
      onReconciliationChanged();
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      rechecking = false;
    }
  }

  function applyById(candidateId: string) {
    const item = itemFor(candidateId);
    if (item) void apply(item);
  }

  function dismissById(candidateId: string) {
    const item = itemFor(candidateId);
    if (item) void decide(item, "dismissed");
  }

  function confirmById(candidateId: string, canonicalObservationId: string) {
    const item = itemFor(candidateId);
    if (item) void decide(item, "confirmed", canonicalObservationId);
  }

  $effect(() => {
    const key = `${projectId ?? ""}\0${refreshKey}`;
    if (key === loadedKey) return;
    loadedKey = key;
    void load();
  });

  $effect(() => {
    const nextProjectId = projectId;
    if (!nextProjectId) {
      loadedMerchantsProjectId = "";
      merchantsById = {};
      return;
    }
    if (nextProjectId === loadedMerchantsProjectId) return;
    loadedMerchantsProjectId = nextProjectId;
    void loadMerchants(nextProjectId);
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

<SharedIngestionReconciliationPanel
  loadingInitial={loading && !reviewLoaded}
  {reviewLoaded}
  {error}
  hasCandidates={candidates.length > 0}
  {activeSearch}
  matchedItemCount={matchedCandidates.length}
  visibleItems={visiblePanelItems}
  actionableItemCount={actionableCandidates.length}
  visibleActionableIds={visibleActionableCandidateIds}
  {selectedCandidateIds}
  {masterSelection}
  {allMatchingSelected}
  {showSelectionBanner}
  {loading}
  {busyCandidateId}
  {bulkConfirming}
  {autoConfirming}
  {rechecking}
  {searchValues}
  facetOptions={reviewFacetOptions}
  {page}
  pageCount={pages.length}
  {pageSize}
  pageSizeOptions={RECONCILIATION_REVIEW_PAGE_SIZES}
  {onSearchQueryInput}
  onClearSearch={clearSearchQuery}
  onClearAllSearch={clearAllSearch}
  onFacetChange={(key, value) => setSearchFacet(key, value)}
  onAutoConfirm={() => void autoConfirmExactMappedMatches()}
  onSetSelectedCandidates={setSelectedCandidates}
  onSelectAllMatching={selectAllMatchingCandidates}
  onClearSelected={clearSelectedCandidates}
  onApply={applyById}
  onDismiss={dismissById}
  onConfirm={confirmById}
  onPageChange={(nextPage) => updateRoute({ reconcilePage: String(nextPage) })}
  onPageSizeChange={(nextSize) =>
    updateRoute({ reconcilePageSize: String(nextSize), reconcilePage: "1" })}
/>
