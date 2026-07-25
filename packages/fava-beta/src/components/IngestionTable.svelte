<script lang="ts">
  import { onDestroy } from "svelte";
  import { DateTime } from "luxon";
  import type { IngestionSyncJob } from "@beancount-js/server";
  import { Amount } from "@beancount-js/beancount";
  import {
    normalizeMerchant,
    type MerchantCandidate,
  } from "@beancount-js/beangulp";
  import type { ProjectSnapshot } from "@beancount-js/workspace";
  import {
    FilterCommandPicker,
    SearchFilterBar,
    type FilterCommandOption,
  } from "@beancount-js/ui/forms";
  import { Decimal } from "@beancount-js/parser";
  import Landmark from "lucide-svelte/icons/landmark";
  import Link2 from "lucide-svelte/icons/link-2";
  import { useStudioWorkspace } from "../studio/workspace";
  import { useContext } from "../context";
  import { ledgerStemForPath } from "../lib/ledger-route";
  import { setStudioRouteEnv } from "../lib/studio-route-env";
  import {
    ingestionHeaderActions,
    type IngestionBulkReviewAction,
  } from "../studio/ingestion-header-actions";
  import { useNavigation } from "../router/router";
  import { debounceWithDelay } from "../hooks/debounce";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    latestIngestionSyncJob,
    startIngestionSync,
    subscribeIngestionSyncEvents,
  } from "../ingestion/sync";
  import {
    ingestionProposalReviewBucket,
    ingestionProposalReviewLabel,
  } from "../ingestion/review-classification";
  import type {
    IngestionConfigResponse,
    IngestionRun,
    IngestionRunPage,
    IngestionRunSummary,
    ImportProposal,
    AiEnrichmentCallRecord,
  } from "../ingestion/types";
  import PagePagination from "./PagePagination.svelte";
  import {
    appendIngestionReviewSearchParams,
    cloneIngestionReviewSearchState,
    collectIngestionReviewFacetOptions,
    filterIngestionReviewSearch,
    hasActiveIngestionReviewSearch,
    MERCHANT_RESOLUTION_STATUS_OPTIONS,
    parseIngestionReviewSearchState,
    type IngestionReviewSearchState,
  } from "../lib/ingestion-review-search-state";
  import {
    pruneReviewSelection,
    updateReviewSelection,
  } from "../lib/review-selection";
  import type {
    ConfirmedProposalReconciliationResponse,
    ReconciliationProposalReconciliationsResponse,
  } from "../lib/reconciliation-review-response";
  import type { SortOrder } from "../grid/sort";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { Progress } from "$lib/components/ui/progress";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import IngestionProposalSheet from "./IngestionProposalSheet.svelte";
  import IngestionReconciliationPanel from "./IngestionReconciliationPanel.svelte";
  import ReviewImportsSkeleton from "./skeletons/ReviewImportsSkeleton.svelte";
  import { useCtx } from "../stores/format";
  import IngestionTable, {
    type IngestionReviewGroup,
    type IngestionReviewRow,
  } from "@beancount-js/ui/tables/IngestionTable.svelte";

  const PAGE_SIZES = [25, 50, 100];
  const ALL_CONNECTIONS = "__all__";
  const REVIEW_UNCATEGORISED_ACCOUNT = "Review:Uncategorised";

  type ReviewFilter = "pending" | "accepted" | "reconciliation";
  type SortKey = "date" | "amount";

  type ProposalRow = {
    key: string;
    runId: string;
    proposal: ImportProposal;
    auditCalls?: readonly AiEnrichmentCallRecord[];
  };

  type DateGroup = {
    key: string;
    date: string;
    label: string;
    rows: ProposalRow[];
  };

  const { activeFile, refreshReviewLedger, reviewLedger, snapshot } =
    useStudioWorkspace();
  const { ledgerOptions } = useContext();
  const ctx = useCtx();
  const { activeRoute, router } = useNavigation();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  let config = $state<IngestionConfigResponse | undefined>(undefined);
  let runSummaries = $state<IngestionRunSummary[]>([]);
  let runs = $state<IngestionRun[]>([]);
  let activeRuns = $state<IngestionRun[]>([]);
  let sourceId = $state(ALL_CONNECTIONS);
  let status = $state("");
  let loading = $state(false);
  let accepting = $state(false);
  let bulkUpdating = $state(false);
  let bulkActionBusyLabel = $state<string | undefined>(undefined);
  let loadedProjectId = $state("");
  let syncJob = $state<IngestionSyncJob | null>(null);
  let syncAbort = $state<AbortController | null>(null);
  let expandedGroups = $state(new Set<string>());
  let expandedSignature = $state("");
  let selectedRow = $state<ProposalRow | undefined>(undefined);
  let selectedProposalKeys = $state(new Set<string>());
  let reconciliationBulkAction = $state<IngestionBulkReviewAction | undefined>(
    undefined,
  );
  let sheetOpen = $state(false);
  let failedLogoIds = $state(new Set<string>());
  let filtersExpanded = $state(false);
  let searchState = $state<IngestionReviewSearchState>(
    cloneIngestionReviewSearchState(),
  );
  let lastSearchSignature = $state("");
  let sortOrders = $state<Record<SortKey, SortOrder>>({
    date: "none",
    amount: "none",
  });
  let reconciliationCount = $state(0);
  let reconciliationCountKey = $state("");
  let reconciliationProposalRows = $state<
    ConfirmedProposalReconciliationResponse[]
  >([]);
  let reconciliationProposalRowsKey = $state("");
  let reconciliationProposalRevision = $state(0);
  let clearingReconciliationCandidateId = $state("");

  const project = $derived($snapshot);
  const querySourceId = $derived($activeRoute?.query?.sourceId ?? "");
  const queryRunId = $derived($activeRoute?.query?.runId ?? "");
  const queryProposalId = $derived($activeRoute?.query?.proposalId ?? "");
  const reviewFilter = $derived<ReviewFilter>(
    $activeRoute?.query?.review === "accepted"
      ? "accepted"
      : $activeRoute?.query?.review === "reconciliation"
        ? "reconciliation"
        : "pending",
  );
  const showingReconciliation = $derived(reviewFilter === "reconciliation");
  const selectedSource = $derived(
    sourceId === ALL_CONNECTIONS
      ? undefined
      : config?.sources.find((source) => source.id === sourceId),
  );
  const allConnections = $derived(sourceId === ALL_CONNECTIONS);
  const syncing = $derived(
    syncJob?.status === "queued" || syncJob?.status === "running",
  );
  const allowedAccounts = $derived(
    selectedSource?.allowedAccounts?.length
      ? selectedSource.allowedAccounts
      : (config?.accounts ?? []),
  );

  const proposalRows = $derived.by((): ProposalRow[] =>
    activeRuns.flatMap((run) =>
      run.proposals.map((proposal) => ({
        key: `${run.id}:${proposal.id}`,
        runId: run.id,
        proposal,
        auditCalls: run.audit?.ai,
      })),
    ),
  );
  const reconciliationsByProposal = $derived.by(() => {
    const result = new Map<string, ConfirmedProposalReconciliationResponse[]>();
    for (const reconciliation of reconciliationProposalRows) {
      const key = `${reconciliation.runId}:${reconciliation.proposalId}`;
      const rows = result.get(key) ?? [];
      rows.push(reconciliation);
      result.set(key, rows);
    }
    return result;
  });

  function isReadyRow(row: ProposalRow) {
    return ingestionProposalReviewBucket(row.proposal) === "ready";
  }

  function isPendingRow(row: ProposalRow) {
    return ingestionProposalReviewBucket(row.proposal) === "review";
  }

  const ready = $derived(proposalRows.filter(isReadyRow));
  const pending = $derived(proposalRows.filter(isPendingRow));

  const reviewTabRows = $derived(
    reviewFilter === "reconciliation"
      ? []
      : reviewFilter === "accepted"
        ? ready
        : pending,
  );

  const activeSearch = $derived(hasActiveIngestionReviewSearch(searchState));

  const matchingProposals = $derived(
    new Set(
      filterIngestionReviewSearch(
        reviewTabRows.map((row) => row.proposal),
        searchState,
      ),
    ),
  );
  const filteredRows = $derived(
    reviewTabRows.filter((row) => matchingProposals.has(row.proposal)),
  );

  const facetOptions = $derived(
    collectIngestionReviewFacetOptions(
      reviewTabRows.map((row) => row.proposal),
    ),
  );

  const accountOptions = $derived<FilterCommandOption[]>(
    facetOptions.accounts.map((value) => ({ value, label: value })),
  );
  const yearOptions = $derived<FilterCommandOption[]>(
    facetOptions.years.map((value) => ({ value, label: value })),
  );
  const currencyOptions = $derived<FilterCommandOption[]>(
    facetOptions.currencies.map((value) => ({ value, label: value })),
  );
  const merchantStatusOptions = $derived<FilterCommandOption[]>(
    MERCHANT_RESOLUTION_STATUS_OPTIONS.map((option) => ({ ...option })),
  );

  const dateGroups = $derived.by((): DateGroup[] => {
    const buckets = new Map<string, ProposalRow[]>();
    for (const row of filteredRows) {
      const date = row.proposal.transaction?.bookedAt ?? "unknown";
      const list = buckets.get(date) ?? [];
      list.push(row);
      buckets.set(date, list);
    }
    const dateOrder = sortOrders.date === "none" ? "desc" : sortOrders.date;
    const amountOrder =
      sortOrders.amount === "none" ? "desc" : sortOrders.amount;
    return [...buckets.entries()]
      .sort(([left], [right]) => compareDateKeys(left, right, dateOrder))
      .map(([date, rows]) => ({
        key: date,
        date,
        label: formatGroupDate(date),
        rows: rows.sort((left, right) =>
          compareProposalAmounts(left, right, amountOrder),
        ),
      }));
  });

  const uiFilter = $derived<"review" | "ready">(
    reviewFilter === "accepted" ? "ready" : "review",
  );
  const uiCounts = $derived({
    review: pending.length,
    ready: ready.length,
    duplicates,
  });
  const proposalRowsById = $derived(
    new Map(proposalRows.map((row) => [row.key, row] as const)),
  );

  const sourceOptions = $derived([
    { value: ALL_CONNECTIONS, label: "All connections" },
    ...(config?.sources ?? []).map((source) => ({
      value: source.id,
      label: `${source.name}${source.credentialAvailable ? "" : " (credential unavailable)"}`,
    })),
  ]);

  const canForceRefetch = $derived(
    Boolean(
      !allConnections &&
        sourceId &&
        !loading &&
        !syncing &&
        selectedSource?.credentialAvailable,
    ),
  );

  const sourceAiEnabled = $derived(
    selectedSource?.aiEnabled === true ||
      (selectedSource?.merchantEnrichment?.enabled === true &&
        selectedSource.merchantEnrichment.aiEnabled === true),
  );

  const reviewableProposalCount = $derived(
    activeRuns.reduce(
      (count, run) =>
        count +
        run.proposals.filter(
          (proposal) =>
            Boolean(proposal.transaction) &&
            (proposal.status === "ready" ||
              proposal.status === "needs-review" ||
              proposal.status === "held"),
        ).length,
      0,
    ),
  );

  const canRerunAi = $derived(
    Boolean(
      !allConnections &&
        sourceId &&
        sourceAiEnabled &&
        reviewableProposalCount > 0 &&
        !loading &&
        !syncing,
    ),
  );

  const aiRerunBusy = $derived(syncing && syncJob?.kind === "ai-rerun");

  const aiRerunProgressValue = $derived.by(() => {
    if (!syncJob || syncJob.kind !== "ai-rerun") return 0;
    const imported = syncJob.progress.imported ?? 0;
    if (imported <= 0) return 0;
    const seen = syncJob.progress.seen ?? 0;
    return Math.min(100, (seen / imported) * 100);
  });

  const aiRerunProgressCaption = $derived.by(() => {
    if (!syncJob || syncJob.kind !== "ai-rerun") return "";
    const message =
      syncJob.progress.message ??
      "Re-running AI enrichment and categorisation…";
    const imported = syncJob.progress.imported ?? 0;
    if (imported > 0) {
      const seen = syncJob.progress.seen ?? 0;
      return `${message} · ${seen} / ${imported}`;
    }
    return message;
  });

  const duplicates = $derived(
    proposalRows.filter((row) => row.proposal.status === "duplicate").length,
  );
  const reconciliationRefreshKey = $derived(
    activeRuns
      .map(
        (run) =>
          `${run.id}:${run.proposals.map((proposal) => `${proposal.id}:${proposal.status}`).join(",")}`,
      )
      .join("|"),
  );

  const pageSize = $derived(
    PAGE_SIZES.includes(Number($activeRoute?.query?.pageSize))
      ? Number($activeRoute.query.pageSize)
      : 50,
  );
  const pages = $derived(paginateProposalGroups(dateGroups, pageSize));
  const requestedPage = $derived(
    Math.max(1, Number($activeRoute?.query?.page) || 1),
  );
  const page = $derived(Math.min(requestedPage, Math.max(1, pages.length)));
  const visibleGroups = $derived(pages[page - 1] ?? []);
  const groupsCollapsedAll = $derived(
    dateGroups.every((group) => !expandedGroups.has(group.key)),
  );
  const actionableRows = $derived(
    reviewFilter === "accepted"
      ? filteredRows
      : reviewFilter === "pending"
        ? filteredRows.filter(canBulkApproveRow)
        : [],
  );
  const actionableKeySet = $derived(
    new Set(actionableRows.map((row) => row.key)),
  );
  const selectedProposalRows = $derived(
    actionableRows.filter((row) => selectedProposalKeys.has(row.key)),
  );
  const merchantConfirmations = $derived(
    merchantConfirmationsFor(selectedProposalRows),
  );
  const visibleActionableKeys = $derived(
    visibleGroups.flatMap((group) =>
      group.rows
        .filter((row) => actionableKeySet.has(row.key))
        .map((row) => row.key),
    ),
  );

  function reviewToUiRow(row: ProposalRow): IngestionReviewRow {
    const proposals = row.proposal;
    const reviewStatus =
      proposals.status === "ready"
        ? "ready"
        : proposals.status === "needs-review"
          ? "needs-review"
          : proposals.status === "held"
            ? "held"
            : proposals.status === "duplicate"
              ? "duplicate"
              : "accepted";
    const postings = rowPostings(row.proposal);
    return {
      id: row.key,
      title: rowTitle(proposals),
      detail: rowDetail(proposals),
      status: reviewStatus,
      statusLabel: ingestionProposalReviewLabel(proposals),
      amount: postings.length ? undefined : rowAmount(proposals),
      postings: postings.length
        ? postings.map((posting) => ({
            account: posting.account,
            amount: convertPostingAmount(posting.amount),
          }))
        : undefined,
      imageUrl: !failedLogoIds.has(row.proposal.id)
        ? merchantLogo(row.proposal)
        : undefined,
      initial: rowInitial(proposals),
      selectable: reviewFilter === "pending" ? canBulkApproveRow(row) : true,
    };
  }

  const uiGroups = $derived(
    visibleGroups.map(
      (group): IngestionReviewGroup => ({
        id: group.key,
        label: group.label,
        rows: group.rows.map(reviewToUiRow),
      }),
    ),
  );

  const tableEmptyMessage = $derived(
    activeSearch
      ? "No proposals match this search."
      : reviewFilter === "accepted"
        ? "No transactions are ready to accept."
        : pending.length === 0 && ready.length > 0
          ? "All proposals are ready to accept."
          : "No proposals pending review in this import run.",
  );

  function handleIngestionTableSelection(nextIds: readonly string[]) {
    const next = new Set(nextIds);
    const nextSelection = new Set(selectedProposalKeys);
    for (const id of visibleActionableKeys) {
      nextSelection.delete(id);
    }
    for (const id of next) {
      if (visibleActionableKeys.includes(id)) {
        nextSelection.add(id);
      }
    }
    selectedProposalKeys = nextSelection;
  }

  function handleIngestionTableOpen(row: IngestionReviewRow) {
    const target = proposalRowsById.get(row.id);
    if (!target) return;
    openRow(target);
  }

  function convertPostingAmount(amount: Amount) {
    return $ctx.money(amount, amount.currency ?? undefined);
  }
  const visibleAllSelected = $derived(
    visibleActionableKeys.every((id) => selectedProposalKeys.has(id)),
  );
  const allMatchingSelected = $derived(
    actionableRows.length > 0 &&
      selectedProposalKeys.size === actionableRows.length,
  );
  const showSelectionBanner = $derived(
    actionableRows.length > visibleActionableKeys.length &&
      visibleActionableKeys.length > 0 &&
      (visibleAllSelected || allMatchingSelected),
  );
  const transactionBulkAction = $derived.by(
    (): IngestionBulkReviewAction | undefined => {
      if (!selectedProposalRows.length || showingReconciliation) return;
      const approving = reviewFilter === "pending";
      return {
        label: approving ? "Approve" : "Accept",
        busyLabel: bulkActionBusyLabel,
        selectedCount: selectedProposalRows.length,
        canRun: !loading && !syncing && !accepting && !bulkUpdating,
        busy: approving ? bulkUpdating : accepting,
        onRun: approving
          ? () => void approveSelectedProposals()
          : () => void accept(selectedProposalRows),
        additionalActions: approving
          ? [
              {
                label: "Confirm merchants",
                disabled: merchantConfirmations.length === 0,
                onRun: () => void confirmSelectedMerchants(),
              },
            ]
          : undefined,
      };
    },
  );

  function paginateProposalGroups(
    groups: readonly DateGroup[],
    size: number,
  ): DateGroup[][] {
    const result: DateGroup[][] = [];
    let current: DateGroup[] = [];
    let count = 0;
    for (const group of groups) {
      if (current.length && count + group.rows.length > size) {
        result.push(current);
        current = [];
        count = 0;
      }
      current.push(group);
      count += group.rows.length;
    }
    if (current.length) result.push(current);
    return result;
  }

  function canBulkApproveRow(row: ProposalRow) {
    return (
      row.proposal.status !== "held" && Boolean(row.proposal.selectedAccount)
    );
  }

  type MerchantConfirmation = {
    row: ProposalRow;
    candidate: MerchantCandidate;
  };

  /**
   * Confirming a merchant fans out to the matching source label. Keep one
   * request per source/label pair so a selection containing duplicate rows does
   * not make a second, stale confirmation request.
   */
  function merchantConfirmationsFor(rows: readonly ProposalRow[]) {
    const confirmations = new Map<string, MerchantConfirmation>();
    for (const row of rows) {
      const resolution = row.proposal.merchantResolution;
      if (resolution?.status !== "suggested") continue;
      const candidate = resolution.candidates[0];
      if (!candidate) continue;
      const sourceId =
        activeRuns.find((run) => run.id === row.runId)?.sourceId ?? row.runId;
      const key = `${sourceId}\0${normalizeMerchant(resolution.rawLabel)}`;
      if (!confirmations.has(key)) confirmations.set(key, { row, candidate });
    }
    return [...confirmations.values()];
  }

  function setSelectedRows(rowKeys: readonly string[], selected: boolean) {
    selectedProposalKeys = updateReviewSelection(
      selectedProposalKeys,
      rowKeys,
      selected,
    );
  }

  function selectAllMatchingRows() {
    selectedProposalKeys = new Set(actionableRows.map((row) => row.key));
  }

  function clearSelectedRows() {
    selectedProposalKeys = new Set();
  }

  function setReconciliationBulkAction(
    action: IngestionBulkReviewAction | undefined,
  ) {
    reconciliationBulkAction = action;
  }

  async function loadReconciliationCount(projectId: string) {
    try {
      const summary = await ingestionJson<{ count: number }>(
        ingestionPath(projectId, "/reconciliation?summary=count"),
      );
      if (project?.project.id === projectId) {
        reconciliationCount = summary.count;
      }
    } catch {
      if (project?.project.id === projectId) reconciliationCount = 0;
    }
  }

  async function loadReconciliationProposalRows(projectId: string) {
    try {
      const response =
        await ingestionJson<ReconciliationProposalReconciliationsResponse>(
          ingestionPath(
            projectId,
            "/reconciliation?summary=proposal-reconciliations",
          ),
        );
      if (project?.project.id === projectId) {
        reconciliationProposalRows = response.reconciliations;
      }
    } catch {
      if (project?.project.id === projectId) reconciliationProposalRows = [];
    }
  }

  function reconciliationChanged() {
    reconciliationProposalRevision += 1;
  }

  function handleReconciliationChanged() {
    reconciliationChanged();
    void refresh();
  }

  function updateRoute(values: Record<string, string | undefined>) {
    const query = new URLSearchParams($activeRoute.query);
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
      params.get("reviewQ") ?? "",
      params.get("reviewAccounts") ?? "",
      params.get("reviewMerchant") ?? "",
      params.get("reviewYears") ?? "",
      params.get("reviewCurrency") ?? "",
    ].join("\0");
  }

  function applySearchState(
    next: IngestionReviewSearchState,
    resetPage = true,
  ) {
    searchState = cloneIngestionReviewSearchState(next);
    const params = new URLSearchParams($activeRoute.query);
    appendIngestionReviewSearchParams(params, next);
    if (resetPage) params.set("page", "1");
    lastSearchSignature = searchSignature(Object.fromEntries(params));
    const search = params.toString();
    router.updateState(search ? `?${search}` : "?");
  }

  const [scheduleSearchSync, delaySearchSync] = debounceWithDelay(
    (next: IngestionReviewSearchState) => {
      applySearchState(next);
    },
    250,
  );

  function onSearchQueryInput(value: string) {
    searchState = { ...searchState, query: value };
    scheduleSearchSync(searchState);
    delaySearchSync();
  }

  function setSearchFacet<K extends keyof IngestionReviewSearchState>(
    key: K,
    value: IngestionReviewSearchState[K],
  ) {
    applySearchState({ ...searchState, [key]: value });
  }

  function clearSearchQuery() {
    applySearchState({ ...searchState, query: "" });
  }

  function clearAllSearch() {
    applySearchState(cloneIngestionReviewSearchState());
  }

  $effect(() => {
    const signature = searchSignature($activeRoute.query);
    if (signature === lastSearchSignature) return;
    lastSearchSignature = signature;
    searchState = parseIngestionReviewSearchState($activeRoute.query);
  });

  $effect(() => {
    const next = pruneReviewSelection(selectedProposalKeys, actionableKeySet);
    if (
      next.size !== selectedProposalKeys.size ||
      [...next].some((key) => !selectedProposalKeys.has(key))
    ) {
      selectedProposalKeys = next;
    }
  });

  function setReviewFilter(value: string | undefined) {
    if (
      value !== "pending" &&
      value !== "accepted" &&
      value !== "reconciliation"
    ) {
      return;
    }
    if (value === reviewFilter) return;
    updateRoute({
      review: value === "pending" ? undefined : value,
      page: "1",
    });
  }

  function compareDateKeys(
    left: string,
    right: string,
    order: Exclude<SortOrder, "none">,
  ) {
    if (left === right) return 0;
    if (left === "unknown") return 1;
    if (right === "unknown") return -1;
    const direction = order === "asc" ? 1 : -1;
    return direction * left.localeCompare(right);
  }

  function compareProposalAmounts(
    left: ProposalRow,
    right: ProposalRow,
    order: Exclude<SortOrder, "none">,
  ) {
    const leftAmount = left.proposal.transaction?.amount;
    const rightAmount = right.proposal.transaction?.amount;
    if (leftAmount === rightAmount) return 0;
    if (leftAmount === undefined) return 1;
    if (rightAmount === undefined) return -1;
    const direction = order === "asc" ? 1 : -1;
    return (
      direction * new Decimal(leftAmount).minus(new Decimal(rightAmount)).number
    );
  }

  function toggleAllGroups() {
    if (groupsCollapsedAll) {
      expandedGroups = new Set(dateGroups.map((group) => group.key));
    } else {
      expandedGroups = new Set();
    }
  }

  $effect(() => {
    const signature = dateGroups.map((group) => group.key).join("|");
    if (!signature || signature === expandedSignature) return;
    expandedSignature = signature;
    expandedGroups = new Set(dateGroups.map((group) => group.key));
  });

  $effect(() => {
    const next = project;
    if (next && !isWeb && next.project.id !== loadedProjectId) {
      void refresh();
    }
  });

  $effect(() => {
    if (!project || isWeb) {
      reconciliationCount = 0;
      reconciliationCountKey = "";
      reconciliationProposalRows = [];
      reconciliationProposalRowsKey = "";
      return;
    }
    const nextKey = `${project.project.id}\0${reconciliationRefreshKey}\0${reconciliationProposalRevision}`;
    if (nextKey === reconciliationCountKey) return;
    reconciliationCountKey = nextKey;
    void loadReconciliationCount(project.project.id);
  });

  $effect(() => {
    if (!project || isWeb) return;
    const nextKey = `${project.project.id}\0${reconciliationRefreshKey}\0${reconciliationProposalRevision}`;
    if (nextKey === reconciliationProposalRowsKey) return;
    reconciliationProposalRowsKey = nextKey;
    void loadReconciliationProposalRows(project.project.id);
  });

  $effect(() => {
    if (isWeb || !project) {
      ingestionHeaderActions.set(null);
      return;
    }
    ingestionHeaderActions.set({
      kind: "review",
      recordCount: proposalRows.length,
      sourceId,
      sourceOptions,
      canForceRefetch,
      canRerunAi,
      aiRerunBusy,
      groupsCollapsedAll,
      canAccept:
        ready.length > 0 && !loading && !accepting && !bulkUpdating && !syncing,
      acceptCount: ready.length,
      acceptBusy: accepting,
      bulkAction: showingReconciliation
        ? reconciliationBulkAction
        : transactionBulkAction,
      canOpenLedger: Boolean($reviewLedger),
      onSourceChange: (nextSourceId) => void loadRunForSource(nextSourceId),
      onToggleCollapseGroups: toggleAllGroups,
      onOpenAccounts: openAccounts,
      onOpenMerchants: () => router.push("/import/merchants"),
      onForceRefetch: () => void fetchTransactions(),
      onRerunAi: () => void rerunAiEnrichment(),
      onEditSources: () => router.push("/import/editor"),
      onAccept: () => void accept(),
      onOpenLedger: openReviewLedger,
      onReviewMerchants: () => router.push("/import/merchants"),
    });
  });

  onDestroy(() => {
    ingestionHeaderActions.set(null);
  });

  function runBelongsToSource(item: IngestionRunSummary, id: string) {
    if (id === ALL_CONNECTIONS) return true;
    return item.sourceId === id || item.sourceId.startsWith(`${id}:`);
  }

  function pickRunIdsForSource(
    items: readonly IngestionRunSummary[],
    id: string,
    preferredRunId?: string,
    syncRunIds?: readonly string[],
  ) {
    // A linked review row can be opened before its source summaries have
    // loaded. Prefer the explicit run in the URL so the initial
    // `__all__` source does not repeatedly clear active runs.
    if (preferredRunId) return [preferredRunId];

    if (id === ALL_CONNECTIONS) {
      const selected = new Map<string, IngestionRunSummary>();
      for (const item of items) {
        const connectionId = item.sourceId.split(":", 1)[0] ?? item.sourceId;
        const current = selected.get(connectionId);
        if (
          !current ||
          (current.reviewState !== "pending" && item.reviewState === "pending")
        ) {
          selected.set(connectionId, item);
        }
      }
      return [...selected.values()].map((item) => item.id);
    }
    const belonging = items.filter((item) => runBelongsToSource(item, id));
    if (!belonging.length) return [] as string[];

    if (syncRunIds?.length) {
      const fromSync = syncRunIds.filter((runId) =>
        belonging.some((item) => item.id === runId),
      );
      if (fromSync.length) return fromSync;
    }

    const reviewable = belonging.find((run) => run.reviewState === "pending");
    return reviewable ? [reviewable.id] : belonging[0] ? [belonging[0].id] : [];
  }

  function runsListPath(projectId: string, nextSourceId?: string) {
    const query = new URLSearchParams({ limit: "100" });
    if (nextSourceId && nextSourceId !== ALL_CONNECTIONS)
      query.set("sourceId", nextSourceId);
    return ingestionPath(projectId, `/runs?${query}`);
  }

  async function refreshRunSummaries(nextSourceId = sourceId) {
    if (!project || isWeb) return [] as IngestionRunSummary[];
    const page = await ingestionJson<IngestionRunPage>(
      runsListPath(project.project.id, nextSourceId),
    );
    runSummaries = page.runs;
    return page.runs;
  }

  async function loadActiveRunsForSource(
    nextSourceId: string,
    preferredRunId?: string,
    syncRunIds?: readonly string[],
    summaries = runSummaries,
  ) {
    if (!project || isWeb || !nextSourceId) return;
    const runIds = pickRunIdsForSource(
      summaries,
      nextSourceId,
      preferredRunId,
      syncRunIds,
    );
    if (!runIds.length) {
      runs = [];
      applyActiveRuns([]);
      return;
    }
    const loaded = await Promise.all(
      runIds.map((runId) =>
        ingestionJson<IngestionRun>(
          ingestionPath(
            project.project.id,
            `/runs/${encodeURIComponent(runId)}`,
          ),
        ),
      ),
    );
    runs = loaded;
    applyActiveRuns(loaded);
  }

  function applyActiveRuns(next: IngestionRun[]) {
    activeRuns = next;
    if (next.length) {
      status = "";
    }
  }

  function replaceRun(updated: IngestionRun) {
    runs = [updated, ...runs.filter((item) => item.id !== updated.id)];
    activeRuns = activeRuns.map((item) =>
      item.id === updated.id ? updated : item,
    );
    if (selectedRow?.runId === updated.id) {
      const proposal = updated.proposals.find(
        (item) => item.id === selectedRow?.proposal.id,
      );
      if (proposal) {
        selectedRow = {
          key: `${updated.id}:${proposal.id}`,
          runId: updated.id,
          proposal,
        };
      }
    }
    void refreshReviewLedger();
  }

  function openReviewLedger() {
    const review = $reviewLedger;
    if (!project || !review) return;
    const available = [
      ...project.ledgerFiles.map((file) => file.path),
      review.path,
    ];
    activeFile.set(review.path);
    setStudioRouteEnv({
      projectId: project.project.id,
      ledgerPath: review.path,
      ledgerStem: ledgerStemForPath(review.path, available),
      availableLedgers: available,
    });
    router.push("/journal");
  }

  async function watchSync(projectId: string, id: string) {
    syncAbort?.abort();
    syncAbort = new AbortController();
    try {
      const latest = await latestIngestionSyncJob(projectId, id);
      syncJob = latest;
      if (
        latest &&
        (latest.status === "queued" || latest.status === "running")
      ) {
        await subscribeIngestionSyncEvents(
          projectId,
          latest.id,
          (event) => {
            syncJob = event.job;
            if (
              event.type === "done" ||
              event.job.status === "completed" ||
              event.job.status === "failed"
            ) {
              void refresh();
            }
          },
          syncAbort.signal,
        );
      } else if (latest?.runIds.length && !activeRuns.length) {
        void loadActiveRunsForSource(id, undefined, latest.runIds);
      }
    } catch {
      // Review page can still work without live sync status.
    }
  }

  async function refresh() {
    if (!project || isWeb) return;
    loading = true;
    try {
      const configResponse = await ingestionJson<IngestionConfigResponse>(
        ingestionPath(project.project.id),
      );
      config = configResponse;
      const preferredSource =
        querySourceId === ALL_CONNECTIONS ||
        (querySourceId &&
          config.sources.some((source) => source.id === querySourceId))
          ? querySourceId
          : sourceId;
      sourceId =
        preferredSource === ALL_CONNECTIONS ||
        config.sources.some((source) => source.id === preferredSource)
          ? preferredSource
          : ALL_CONNECTIONS;
      if (sourceId === ALL_CONNECTIONS) syncJob = null;
      const summaries = await refreshRunSummaries(sourceId);
      let syncRunIds: string[] | undefined;
      if (!allConnections && sourceId) {
        try {
          const latest = await latestIngestionSyncJob(
            project.project.id,
            sourceId,
          );
          syncJob = latest;
          syncRunIds = latest?.runIds;
        } catch {
          syncRunIds = undefined;
        }
      }
      if (sourceId) {
        await loadActiveRunsForSource(
          sourceId,
          queryRunId || undefined,
          syncRunIds,
          summaries,
        );
      } else {
        runs = [];
        applyActiveRuns([]);
      }
      loadedProjectId = project.project.id;
      if (!allConnections && sourceId)
        void watchSync(project.project.id, sourceId);
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function loadRunForSource(nextSourceId: string) {
    sourceId = nextSourceId;
    if (nextSourceId === ALL_CONNECTIONS) syncJob = null;
    updateRoute({
      sourceId: nextSourceId,
      proposalId: undefined,
      runId: undefined,
      page: "1",
    });
    let syncRunIds: string[] | undefined;
    if (project && nextSourceId !== ALL_CONNECTIONS) {
      try {
        const latest = await latestIngestionSyncJob(
          project.project.id,
          nextSourceId,
        );
        syncJob = latest;
        syncRunIds = latest?.runIds;
      } catch {
        syncRunIds = undefined;
      }
    }
    try {
      const summaries = await refreshRunSummaries(nextSourceId);
      await loadActiveRunsForSource(
        nextSourceId,
        undefined,
        syncRunIds,
        summaries,
      );
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
    if (project && nextSourceId !== ALL_CONNECTIONS)
      void watchSync(project.project.id, nextSourceId);
  }

  async function fetchTransactions() {
    if (!project || !sourceId) return;
    loading = true;
    try {
      const response = await ingestionJson<
        IngestionRun | { runs: IngestionRun[] }
      >(ingestionPath(project.project.id, "/runs"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      const createdRuns = "runs" in response ? response.runs : [response];
      runs = createdRuns;
      applyActiveRuns(createdRuns);
      await refreshRunSummaries(sourceId);
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function rerunAiEnrichment() {
    if (!project || !sourceId || !canRerunAi) return;
    status = "Starting AI enrichment…";
    try {
      const { job } = await startIngestionSync(
        project.project.id,
        sourceId,
        "ai-rerun",
      );
      syncJob = job;
      void watchSync(project.project.id, sourceId);
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  function openAccounts() {
    router.push("/import/accounts");
  }

  function openSources() {
    router.push("/import/editor");
  }

  function formatGroupDate(date: string) {
    if (date === "unknown") return "UNKNOWN DATE";
    const parsed = DateTime.fromISO(date, { zone: "utc" });
    return parsed.isValid
      ? parsed.toFormat("LLLL dd, yyyy").toUpperCase()
      : date.toUpperCase();
  }

  function rowTitle(proposal: ImportProposal) {
    if (proposal.merchantResolution?.status === "confirmed") {
      return proposal.merchantResolution.merchant.canonicalName;
    }
    if (proposal.merchantResolution?.status === "suggested") {
      return (
        proposal.merchantResolution.candidates[0]?.canonicalName ??
        proposal.transaction?.merchant ??
        proposal.transaction?.payee ??
        proposal.transaction?.narration ??
        "—"
      );
    }
    return (
      proposal.transaction?.merchant ??
      proposal.transaction?.payee ??
      proposal.transaction?.narration ??
      "—"
    );
  }

  function rowDetail(proposal: ImportProposal) {
    const transaction = proposal.transaction;
    if (!transaction) return proposal.issues[0] ?? "Import proposal";
    const detail = [
      transaction.payee,
      transaction.merchant,
      transaction.narration,
    ]
      .filter(
        (value, index, values) =>
          Boolean(value) && values.indexOf(value) === index,
      )
      .join(" · ");
    return detail || proposal.issues[0] || "Import proposal";
  }

  function rowAmount(proposal: ImportProposal) {
    const tx = proposal.transaction;
    return tx ? `${tx.amount} ${tx.currency}` : "—";
  }

  function reviewOffsetAccount() {
    return `${$ledgerOptions.beancount.name_equity}:${REVIEW_UNCATEGORISED_ACCOUNT}`;
  }

  function rowPostings(proposal: ImportProposal) {
    const transaction = proposal.transaction;
    if (!transaction) return [];
    return [
      {
        account: transaction.sourceAccount,
        amount: new Amount(transaction.amount, transaction.currency),
        source: true,
      },
      {
        account: proposal.selectedAccount ?? reviewOffsetAccount(),
        amount: new Amount(
          new Decimal(transaction.amount).neg().toString(),
          transaction.currency,
        ),
        source: false,
      },
    ];
  }

  async function clearReconciliationDecision(candidateId: string) {
    if (!project || clearingReconciliationCandidateId) return;
    clearingReconciliationCandidateId = candidateId;
    try {
      await ingestionJson(
        ingestionPath(project.project.id, "/reconciliation"),
        {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ candidateId }),
        },
      );
      status = "Cleared reconciliation decision.";
      reconciliationChanged();
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      clearingReconciliationCandidateId = "";
    }
  }

  function rowInitial(proposal: ImportProposal) {
    const title = rowTitle(proposal);
    return title.slice(0, 1).toUpperCase() || "?";
  }

  function merchantLogo(proposal: ImportProposal) {
    if (proposal.merchantResolution?.status === "confirmed") {
      return proposal.merchantResolution.merchant.logoUrl;
    }
    if (proposal.merchantResolution?.status === "suggested") {
      return proposal.merchantResolution.candidates[0]?.logoUrl;
    }
    return undefined;
  }

  function openRow(row: ProposalRow) {
    if (
      queryProposalId === row.proposal.id &&
      queryRunId === row.runId &&
      sheetOpen
    ) {
      return;
    }
    updateRoute({
      proposalId: row.proposal.id,
      runId: row.runId,
      sourceId: sourceId || undefined,
    });
  }

  function closeProposalSheet() {
    if (queryProposalId) {
      updateRoute({ proposalId: undefined });
    }
  }

  $effect(() => {
    if (!queryRunId || !sourceId) return;
    if (activeRuns.some((run) => run.id === queryRunId)) return;
    void loadActiveRunsForSource(sourceId, queryRunId, syncJob?.runIds);
  });

  $effect(() => {
    if (!queryProposalId) {
      if (sheetOpen) sheetOpen = false;
      return;
    }
    const row = proposalRows.find(
      (item) =>
        item.proposal.id === queryProposalId &&
        (!queryRunId || item.runId === queryRunId),
    );
    if (!row) return;
    selectedRow = row;
    sheetOpen = true;
  });

  async function approveSelectedProposals() {
    if (!project || bulkUpdating || !selectedProposalRows.length) return;
    const rows = [...selectedProposalRows];
    bulkUpdating = true;
    status = `Approving ${rows.length} transaction${rows.length === 1 ? "" : "s"}…`;
    let approvedCount = 0;
    try {
      for (const row of rows) {
        const account = row.proposal.selectedAccount;
        if (!account) {
          throw new Error("Choose an account before approving this proposal.");
        }
        const run = await ingestionJson<IngestionRun>(
          ingestionPath(
            project.project.id,
            `/runs/${encodeURIComponent(row.runId)}`,
          ),
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              proposalId: row.proposal.id,
              account,
            }),
          },
        );
        replaceRun(run);
        selectedProposalKeys = updateReviewSelection(
          selectedProposalKeys,
          [row.key],
          false,
        );
        approvedCount += 1;
      }
      status = `Approved ${approvedCount} transaction${approvedCount === 1 ? "" : "s"}.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status = approvedCount
        ? `Approved ${approvedCount} transaction${approvedCount === 1 ? "" : "s"}; ${message}`
        : message;
    } finally {
      bulkUpdating = false;
    }
  }

  async function confirmSelectedMerchants() {
    if (!project || bulkUpdating || !merchantConfirmations.length) return;
    const confirmations = [...merchantConfirmations];
    bulkUpdating = true;
    bulkActionBusyLabel = "Confirming merchants";
    status = `Confirming ${confirmations.length} merchant${confirmations.length === 1 ? "" : "s"}…`;
    let confirmedCount = 0;
    try {
      for (const { row, candidate } of confirmations) {
        const response = await ingestionJson<{ run: IngestionRun }>(
          ingestionPath(
            project.project.id,
            `/runs/${encodeURIComponent(row.runId)}/proposals/${encodeURIComponent(row.proposal.id)}/merchant`,
          ),
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "confirm",
              candidateId: candidate.id,
            }),
          },
        );
        replaceRun(response.run);
        confirmedCount += 1;
      }
      selectedProposalKeys = new Set();
      status = `Confirmed ${confirmedCount} merchant${confirmedCount === 1 ? "" : "s"}.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status = confirmedCount
        ? `Confirmed ${confirmedCount} merchant${confirmedCount === 1 ? "" : "s"}; ${message}`
        : message;
    } finally {
      bulkUpdating = false;
      bulkActionBusyLabel = undefined;
    }
  }

  function markProposalsAcceptedLocally(
    run: IngestionRun,
    proposalIds: ReadonlySet<string>,
  ): IngestionRun {
    const proposals = run.proposals.map((proposal) =>
      proposalIds.has(proposal.id)
        ? {
            ...proposal,
            status: "accepted" as const,
            duplicateOf: undefined,
          }
        : proposal,
    );
    return {
      ...run,
      proposals,
      summary: {
        total: proposals.length,
        ready: proposals.filter((item) => item.status === "ready").length,
        needsReview: proposals.filter((item) => item.status === "needs-review")
          .length,
        accepted: proposals.filter((item) => item.status === "accepted").length,
        duplicates: proposals.filter((item) => item.status === "duplicate")
          .length,
        invalid: proposals.filter((item) => item.status === "invalid").length,
        held: proposals.filter((item) => item.status === "held").length,
        excluded: proposals.filter((item) => item.status === "excluded").length,
      },
    };
  }

  async function accept(rowsToAccept: readonly ProposalRow[] = ready) {
    if (!project || !rowsToAccept.length || !config || accepting) return;

    const byRun = new Map<string, string[]>();
    for (const row of rowsToAccept) {
      const list = byRun.get(row.runId) ?? [];
      list.push(row.proposal.id);
      byRun.set(row.runId, list);
    }
    const acceptedCount = rowsToAccept.length;
    const acceptedAllReady = acceptedCount === ready.length;
    const previousActiveRuns = activeRuns;
    const previousRuns = runs;
    const previousSelection = selectedProposalKeys;

    // Drop the Accept count and Ready list immediately; reconcile from the
    // server response (or roll back) once the ledger write finishes.
    activeRuns = activeRuns.map((run) => {
      const ids = byRun.get(run.id);
      return ids ? markProposalsAcceptedLocally(run, new Set(ids)) : run;
    });
    runs = runs.map((run) => {
      const ids = byRun.get(run.id);
      return ids ? markProposalsAcceptedLocally(run, new Set(ids)) : run;
    });
    closeProposalSheet();
    sheetOpen = false;
    selectedRow = undefined;
    clearSelectedRows();
    if (reviewFilter === "accepted" && acceptedAllReady) {
      updateRoute({ review: undefined, page: "1" });
    }

    accepting = true;
    loading = true;
    status = `Accepting ${acceptedCount} transaction${acceptedCount === 1 ? "" : "s"}…`;
    try {
      let lastSnapshot: ProjectSnapshot | undefined;
      const revisionsByDestination = new Map(
        project.revisions.map((revision) => [revision.path, revision.revision]),
      );
      for (const [runId, proposalIds] of byRun) {
        const run = activeRuns.find((item) => item.id === runId);
        const connectionId = run?.sourceId.split(":", 1)[0] ?? "";
        const source = config.sources.find((item) => item.id === connectionId);
        const destination =
          source?.destinationPath ?? project.project.entryFile;
        const expectedRevision = revisionsByDestination.get(destination);
        if (!expectedRevision) {
          throw new Error(
            "The configured destination is not an editable ledger file.",
          );
        }
        const response: { snapshot: ProjectSnapshot; run: IngestionRun } =
          await ingestionJson<{
            snapshot: ProjectSnapshot;
            run: IngestionRun;
          }>(
            ingestionPath(
              project.project.id,
              `/runs/${encodeURIComponent(runId)}/accept`,
            ),
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ proposalIds, expectedRevision }),
            },
          );
        lastSnapshot = response.snapshot;
        replaceRun(response.run);
        const nextRevision = response.snapshot.revisions.find(
          (revision) => revision.path === destination,
        )?.revision;
        if (nextRevision) revisionsByDestination.set(destination, nextRevision);
      }
      if (lastSnapshot) snapshot.set(lastSnapshot);
      await refreshRunSummaries(sourceId);
      status = `Accepted ${acceptedCount} transaction${acceptedCount === 1 ? "" : "s"}.`;
    } catch (error) {
      activeRuns = previousActiveRuns;
      runs = previousRuns;
      selectedProposalKeys = previousSelection;
      status = error instanceof Error ? error.message : String(error);
    } finally {
      accepting = false;
      loading = false;
    }
  }
</script>

<div
  class="h-full overflow-auto p-3 pb-[calc(60px+env(safe-area-inset-bottom))] sm:p-5"
  data-ingestion-review
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    {#if isWeb}
      <div
        class="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
      >
        Remote API ingestion is available only when this project is opened
        through the local Beancount Studio server.
      </div>
    {:else if !project}
      <div class="rounded-md border p-4 text-sm text-muted-foreground">
        Open a project to configure ingestion.
      </div>
    {/if}

    {#if syncing}
      {#if syncJob?.kind === "ai-rerun"}
        <div class="flex flex-col gap-2">
          <Progress value={aiRerunProgressValue} />
          <p class="text-center text-sm tabular-nums text-muted-foreground">
            {aiRerunProgressCaption}
          </p>
        </div>
      {:else}
        <Alert.Root>
          <Alert.Title>Sync in progress</Alert.Title>
          <Alert.Description>
            {syncJob?.progress.message ||
              "Fetching transactions from Accounts…"}
            Accept is disabled until this finishes.
          </Alert.Description>
        </Alert.Root>
      {/if}
    {/if}

    {#if status}<p class="text-sm text-muted-foreground">{status}</p>{/if}

    {#if (loading || !loadedProjectId) && !activeRuns.length && !isWeb && project}
      <ReviewImportsSkeleton />
    {:else if activeRuns.length}
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex flex-wrap items-center gap-2" role="status">
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            <span class="tabular-nums">{ready.length}</span> ready
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-300"
          >
            <span class="tabular-nums">{pending.length}</span> need review
          </span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-medium text-rose-700 dark:text-rose-300"
          >
            <span class="tabular-nums">{duplicates}</span> duplicates
          </span>
        </div>
        <ToggleGroup.Root
          type="single"
          value={reviewFilter}
          aria-label="Review content filter"
          class="grid w-full grid-cols-3 !gap-0 rounded-lg bg-muted p-1 sm:flex sm:w-auto sm:self-start"
          data-ingestion-review-filter
          onValueChange={setReviewFilter}
        >
          <ToggleGroup.Item
            value="pending"
            class="!inline-flex !h-7 !min-w-0 items-center gap-1.5 !px-2 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:!px-3"
          >
            Review
            <span
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums leading-none"
            >
              {pending.length}
            </span>
          </ToggleGroup.Item>
          <ToggleGroup.Item
            value="accepted"
            class="!inline-flex !h-7 !min-w-0 items-center gap-1.5 !px-2 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:!px-3"
          >
            Ready
            <span
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums leading-none"
            >
              {ready.length}
            </span>
          </ToggleGroup.Item>
          <ToggleGroup.Item
            value="reconciliation"
            class="!inline-flex !h-7 !min-w-0 items-center gap-1.5 !px-2 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:!px-3"
          >
            Reconcile
            <span
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums leading-none"
            >
              {reconciliationCount}
            </span>
          </ToggleGroup.Item>
        </ToggleGroup.Root>
      </div>

      {#if !showingReconciliation}
        <div
          class="ingestion-page-search"
          style="--cv-search-filter-justify: stretch; --cv-search-filter-content-justify: stretch; --cv-search-filter-max-width: 100%;"
        >
          <SearchFilterBar
            inputMode="plain"
            value={searchState.query}
            placeholder="Search proposals…"
            ariaLabel="Search proposals"
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
                  onValuesChange={(accounts) =>
                    setSearchFacet("accounts", accounts)}
                />
                <FilterCommandPicker
                  multiple
                  label="Merchant"
                  values={searchState.merchantStatuses}
                  options={merchantStatusOptions}
                  placeholder="Filter by merchant status…"
                  onValuesChange={(merchantStatuses) =>
                    setSearchFacet("merchantStatuses", merchantStatuses)}
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
                {#if searchState.accounts.length > 0}
                  <FilterCommandPicker
                    multiple
                    label="Account"
                    values={searchState.accounts}
                    options={accountOptions}
                    onValuesChange={(accounts) =>
                      setSearchFacet("accounts", accounts)}
                  />
                {/if}
                {#if searchState.merchantStatuses.length > 0}
                  <FilterCommandPicker
                    multiple
                    label="Merchant"
                    values={searchState.merchantStatuses}
                    options={merchantStatusOptions}
                    onValuesChange={(merchantStatuses) =>
                      setSearchFacet("merchantStatuses", merchantStatuses)}
                  />
                {/if}
                {#if searchState.years.length > 0}
                  <FilterCommandPicker
                    multiple
                    label="Year"
                    values={searchState.years}
                    options={yearOptions}
                    onValuesChange={(years) => setSearchFacet("years", years)}
                  />
                {/if}
                {#if searchState.currencies.length > 0}
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
      {/if}

      {#if showingReconciliation}
        <IngestionReconciliationPanel
          projectId={project?.project.id}
          sources={config?.sources ?? []}
          refreshKey={reconciliationRefreshKey}
          onApplied={handleReconciliationChanged}
          onReconciliationChanged={handleReconciliationChanged}
          onBulkActionChange={setReconciliationBulkAction}
        />
      {:else}
        <IngestionTable
          groups={uiGroups}
          counts={uiCounts}
          filter={uiFilter}
          emptyLabel={tableEmptyMessage}
          selectedIds={[...selectedProposalKeys]}
          onSelectedIdsChange={handleIngestionTableSelection}
          onFilterChange={(next) =>
            setReviewFilter(next === "review" ? "pending" : "accepted")}
          onOpenRow={handleIngestionTableOpen}
        />

        {#if showSelectionBanner}
          <div
            data-review-selection-banner
            role="status"
            class="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
          >
            {#if allMatchingSelected}
              All {actionableRows.length} matching review items selected.
              <button
                type="button"
                class="font-medium text-primary underline-offset-2 hover:underline"
                onclick={clearSelectedRows}
              >
                Clear selection
              </button>
            {:else}
              All {visibleActionableKeys.length} actionable items on this page are
              selected.
              <button
                type="button"
                class="font-medium text-primary underline-offset-2 hover:underline"
                onclick={selectAllMatchingRows}
              >
                Select all {actionableRows.length} matching items
              </button>
            {/if}
          </div>
        {/if}
      {/if}

      {#if !showingReconciliation && pages.length > 1}
        <div
          class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          data-review-import-pagination
        >
          <span class="text-sm text-muted-foreground"
            >Page {page} of {pages.length}</span
          >
          <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <div class="hidden items-center gap-2 sm:flex">
              <label
                class="text-sm text-muted-foreground"
                for="ingestion-review-page-size">Records per page</label
              >
              <select
                id="ingestion-review-page-size"
                class="h-8 rounded-md border bg-background px-2 text-sm"
                value={pageSize}
                onchange={(event) =>
                  updateRoute({
                    pageSize: (event.currentTarget as HTMLSelectElement).value,
                    page: "1",
                  })}
              >
                {#each PAGE_SIZES as size (size)}
                  <option value={size}>{size}</option>
                {/each}
              </select>
            </div>
            <PagePagination
              {page}
              pageCount={pages.length}
              ariaLabel="Review import pages"
              disabled={loading || bulkUpdating || syncing}
              onPageChange={(nextPage) =>
                updateRoute({ page: String(nextPage) })}
            />
          </div>
        </div>
      {/if}
    {:else if !isWeb && project}
      <Empty.Root class="min-h-64 border">
        <Empty.Header>
          <Empty.Media variant="icon"><Landmark /></Empty.Media>
          {#if config?.sources.length}
            <Empty.Title>No imports to review</Empty.Title>
            <Empty.Description
              >Sync from Accounts, then review proposals here.</Empty.Description
            >
          {:else}
            <Empty.Title>No ingestion sources</Empty.Title>
            <Empty.Description
              >Add a JSON API source under Sources first.</Empty.Description
            >
          {/if}
        </Empty.Header>
        <Empty.Content>
          {#if config?.sources.length}
            <Button type="button" onclick={openAccounts}>
              Open Accounts
              <Link2 class="size-4" aria-hidden="true" />
            </Button>
          {:else}
            <Button type="button" onclick={openSources}>
              Open Sources
              <Link2 class="size-4" aria-hidden="true" />
            </Button>
          {/if}
        </Empty.Content>
      </Empty.Root>
    {/if}
  </div>
</div>

{#if selectedRow && project}
  {#key selectedRow.key}
    <IngestionProposalSheet
      bind:open={sheetOpen}
      proposal={selectedRow.proposal}
      runId={selectedRow.runId}
      projectId={project.project.id}
      auditCalls={selectedRow.auditCalls}
      {allowedAccounts}
      aiEnabled={sourceAiEnabled}
      onClosed={closeProposalSheet}
      onUpdated={replaceRun}
      onStatus={(message) => (status = message)}
    />
  {/key}
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
