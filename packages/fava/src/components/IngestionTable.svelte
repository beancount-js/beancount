<script lang="ts">
  import { onDestroy } from "svelte";
  import { DateTime } from "luxon";
  import type { IngestionSyncJob } from "@beancount-js/server";
  import type { ProjectSnapshot } from "@beancount-js/workspace";
  import {
    FilterCommandPicker,
    SearchFilterBar,
    type FilterCommandOption,
  } from "@beancount-js/forms";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronUp from "lucide-svelte/icons/chevron-up";
  import ChevronsLeft from "lucide-svelte/icons/chevrons-left";
  import ChevronsRight from "lucide-svelte/icons/chevrons-right";
  import Landmark from "lucide-svelte/icons/landmark";
  import Link2 from "lucide-svelte/icons/link-2";
  import Undo2 from "lucide-svelte/icons/undo-2";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ledgerStemForPath } from "../lib/ledger-route";
  import { setStudioRouteEnv } from "../lib/studio-route-env";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useNavigation } from "../router/router";
  import { debounceWithDelay } from "../hooks/debounce";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    latestIngestionSyncJob,
    startIngestionSync,
    subscribeIngestionSyncEvents,
  } from "../ingestion/sync";
  import type {
    IngestionConfigResponse,
    IngestionRun,
    IngestionRunPage,
    IngestionRunSummary,
    ImportProposal,
  } from "../ingestion/types";
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
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { Progress } from "$lib/components/ui/progress";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import IngestionProposalSheet from "./IngestionProposalSheet.svelte";
  import IngestionReconciliationPanel from "./IngestionReconciliationPanel.svelte";
  import ReviewImportsSkeleton from "./skeletons/ReviewImportsSkeleton.svelte";

  const PAGE_SIZES = [25, 50, 100];
  const ALL_CONNECTIONS = "__all__";

  type ReviewFilter = "pending" | "accepted" | "reconciliation";

  type ProposalRow = {
    key: string;
    runId: string;
    proposal: ImportProposal;
  };

  type DateGroup = {
    key: string;
    date: string;
    label: string;
    rows: ProposalRow[];
  };

  const { activeFile, refreshReviewLedger, reviewLedger, snapshot } =
    useStudioWorkspace();
  const { activeRoute, router } = useNavigation();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  let config = $state<IngestionConfigResponse | undefined>(undefined);
  let runSummaries = $state<IngestionRunSummary[]>([]);
  let runs = $state<IngestionRun[]>([]);
  let activeRuns = $state<IngestionRun[]>([]);
  let sourceId = $state(ALL_CONNECTIONS);
  let status = $state("");
  let loading = $state(false);
  let loadedProjectId = $state("");
  let syncJob = $state<IngestionSyncJob | null>(null);
  let syncAbort = $state<AbortController | null>(null);
  let expandedGroups = $state(new Set<string>());
  let expandedSignature = $state("");
  let selectedRow = $state<ProposalRow | undefined>(undefined);
  let sheetOpen = $state(false);
  let failedLogoIds = $state(new Set<string>());
  let filtersExpanded = $state(false);
  let searchState = $state<IngestionReviewSearchState>(
    cloneIngestionReviewSearchState(),
  );
  let lastSearchSignature = $state("");

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
      })),
    ),
  );

  function isAcceptedRow(row: ProposalRow) {
    return (
      row.proposal.status === "ready" && Boolean(row.proposal.selectedAccount)
    );
  }

  function isPendingRow(row: ProposalRow) {
    if (!row.proposal.transaction) return false;
    if (isAcceptedRow(row)) return false;
    return (
      row.proposal.status === "needs-review" ||
      row.proposal.status === "held" ||
      row.proposal.status === "ready"
    );
  }

  const accepted = $derived(proposalRows.filter(isAcceptedRow));
  const pending = $derived(proposalRows.filter(isPendingRow));

  const reviewTabRows = $derived(
    reviewFilter === "reconciliation"
      ? []
      : reviewFilter === "accepted"
        ? accepted
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
    return [...buckets.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, rows]) => ({
        key: date,
        date,
        label: formatGroupDate(date),
        rows: rows.sort((left, right) =>
          (right.proposal.transaction?.amount ?? "").localeCompare(
            left.proposal.transaction?.amount ?? "",
          ),
        ),
      }));
  });

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

  const summaryLine = $derived.by(() => {
    if (!activeRuns.length) return "";
    const totals = activeRuns.reduce(
      (acc, run) => ({
        ready: acc.ready + run.summary.ready,
        needsReview: acc.needsReview + run.summary.needsReview,
        duplicates: acc.duplicates + run.summary.duplicates,
      }),
      { ready: 0, needsReview: 0, duplicates: 0 },
    );
    return `${totals.ready} ready · ${totals.needsReview} need review · ${totals.duplicates} duplicates`;
  });
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
    if (isWeb || !project) {
      ingestionHeaderActions.set(null);
      return;
    }
    ingestionHeaderActions.set({
      kind: "review",
      sourceId,
      sourceOptions,
      canForceRefetch,
      canRerunAi,
      aiRerunBusy,
      groupsCollapsedAll,
      canAccept: accepted.length > 0 && !loading && !syncing,
      acceptCount: accepted.length,
      acceptBusy: loading,
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
    if (preferredRunId) return [preferredRunId];
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
    const category =
      proposal.selectedAccount ??
      proposal.suggestions[0]?.account ??
      proposal.issues[0] ??
      "Uncategorized";
    const aiError =
      proposal.lastAiEnrichment?.ok === false ? " · AI error" : "";
    return `${proposal.status} · ${category}${aiError}`;
  }

  function rowAmount(proposal: ImportProposal) {
    const tx = proposal.transaction;
    return tx ? `${tx.amount} ${tx.currency}` : "—";
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

  function toggleSummary(groupKey: string) {
    const next = new Set(expandedGroups);
    if (next.has(groupKey)) next.delete(groupKey);
    else next.add(groupKey);
    expandedGroups = next;
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

  function handleRowKeydown(event: KeyboardEvent, row: ProposalRow) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRow(row);
    }
  }

  function markLogoFailed(proposalId: string) {
    failedLogoIds = new Set([...failedLogoIds, proposalId]);
  }

  async function unacceptRow(row: ProposalRow, event?: Event) {
    event?.stopPropagation();
    event?.preventDefault();
    if (!project || loading || syncing) return;
    loading = true;
    try {
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
            status: "needs-review",
          }),
        },
      );
      replaceRun(run);
      status = "Moved proposal back to pending review.";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
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

  async function accept() {
    if (!project || !accepted.length || !config) return;

    const byRun = new Map<string, string[]>();
    for (const row of accepted) {
      const list = byRun.get(row.runId) ?? [];
      list.push(row.proposal.id);
      byRun.set(row.runId, list);
    }
    const acceptedCount = accepted.length;
    const previousActiveRuns = activeRuns;
    const previousRuns = runs;

    // Drop the Accept count and Accepted list immediately; reconcile from the
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
    if (reviewFilter === "accepted") {
      updateRoute({ review: undefined, page: "1" });
    }

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
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }
</script>

<div class="h-full overflow-auto p-3 sm:p-5" data-ingestion-review>
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

    {#if loading && !activeRuns.length && !isWeb && project}
      <ReviewImportsSkeleton />
    {:else if activeRuns.length}
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold">Review</h2>
          {#if summaryLine}
            <p class="text-sm text-muted-foreground">{summaryLine}</p>
          {/if}
        </div>
        <ToggleGroup.Root
          type="single"
          value={reviewFilter}
          aria-label="Review content filter"
          class="!gap-0 self-start rounded-lg bg-muted p-1"
          data-ingestion-review-filter
          onValueChange={setReviewFilter}
        >
          <ToggleGroup.Item
            value="pending"
            class="!inline-flex !h-7 !min-w-0 items-center gap-1.5 !px-3 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            Pending Review
            <span
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums leading-none"
            >
              {pending.length}
            </span>
          </ToggleGroup.Item>
          <ToggleGroup.Item
            value="accepted"
            class="!inline-flex !h-7 !min-w-0 items-center gap-1.5 !px-3 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            Accepted
            <span
              class="inline-flex min-w-5 items-center justify-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[0.65rem] font-semibold tabular-nums leading-none"
            >
              {accepted.length}
            </span>
          </ToggleGroup.Item>
          <ToggleGroup.Item
            value="reconciliation"
            class="!inline-flex !h-7 !min-w-0 items-center gap-1.5 !px-3 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            Reconcile matches
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
          refreshKey={reconciliationRefreshKey}
          onApplied={() => void refresh()}
        />
      {:else}
        <div
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <span>Date</span>
          <span class="text-right">Amount</span>
        </div>

        {#if !dateGroups.length}
          <div
            class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
          >
            {#if activeSearch}
              No proposals match this search.
            {:else if reviewFilter === "accepted"}
              No accepted proposals yet. Review pending items and set an account
              first.
            {:else if pending.length === 0 && accepted.length > 0}
              All reviewable proposals are accepted.
            {:else}
              No proposals pending review in this import run.
            {/if}
          </div>
        {:else}
          {#each visibleGroups as group (group.key)}
            {@const expanded = expandedGroups.has(group.key)}
            {@const groupId = `ingestion-group-${group.key}`}
            {@const summaryId = `ingestion-summary-${group.key}`}
            <section
              class="overflow-hidden rounded-2xl bg-muted/80"
              aria-labelledby={groupId}
            >
              <div
                class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4"
              >
                <button
                  type="button"
                  class="flex min-w-0 items-center justify-between gap-3 rounded-md text-left outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  aria-expanded={expanded}
                  aria-controls={summaryId}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`}
                  onclick={() => toggleSummary(group.key)}
                >
                  <span
                    id={groupId}
                    role="heading"
                    aria-level="2"
                    class="truncate text-sm font-semibold tracking-wide text-foreground"
                  >
                    {group.label}
                    <span class="ml-2 text-muted-foreground"
                      >· {group.rows.length}</span
                    >
                  </span>
                </button>
                <button
                  type="button"
                  class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-expanded={expanded}
                  aria-controls={summaryId}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`}
                  onclick={() => toggleSummary(group.key)}
                >
                  {#if expanded}
                    <ChevronUp class="size-4" />
                  {:else}
                    <ChevronDown class="size-4" />
                  {/if}
                </button>
              </div>

              {#if expanded}
                <div
                  id={summaryId}
                  class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm"
                >
                  {#each group.rows as row, index (row.key)}
                    {@const logo = merchantLogo(row.proposal)}
                    <div
                      role="button"
                      tabindex="0"
                      class:rounded-b-xl={index === group.rows.length - 1}
                      class="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-[15px] py-4 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Review ${rowTitle(row.proposal)}`}
                      onclick={() => openRow(row)}
                      onkeydown={(event) => handleRowKeydown(event, row)}
                    >
                      {#if logo && !failedLogoIds.has(row.proposal.id)}
                        <img
                          class="size-10 rounded-full border object-contain"
                          src={logo}
                          alt=""
                          onerror={() => markLogoFailed(row.proposal.id)}
                        />
                      {:else}
                        <div
                          class="flex size-10 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground"
                          aria-hidden="true"
                        >
                          {rowInitial(row.proposal)}
                        </div>
                      {/if}
                      <div class="min-w-0">
                        <div class="truncate text-sm font-semibold">
                          {rowTitle(row.proposal)}
                        </div>
                        <div
                          class="mt-1 truncate text-xs text-muted-foreground"
                        >
                          {rowDetail(row.proposal)}
                        </div>
                      </div>
                      <div class="flex items-center gap-1">
                        {#if reviewFilter === "accepted"}
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            class="size-8 text-muted-foreground"
                            aria-label={`Move ${rowTitle(row.proposal)} to pending review`}
                            title="Move to pending review"
                            disabled={loading || syncing}
                            onclick={(event) => void unacceptRow(row, event)}
                          >
                            <Undo2 class="size-4" />
                          </Button>
                        {/if}
                        <span class="text-sm font-semibold tabular-nums">
                          {rowAmount(row.proposal)}
                        </span>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
          {/each}
        {/if}
      {/if}

      {#if !showingReconciliation && pages.length > 1}
        <nav
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
          aria-label="Review import pages"
        >
          <span class="text-sm text-muted-foreground"
            >Page {page} of {pages.length}</span
          >
          <div class="flex items-center gap-2">
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
            <Button
              size="icon"
              variant="outline"
              aria-label="Previous review page"
              disabled={page <= 1}
              onclick={() => updateRoute({ page: String(page - 1) })}
            >
              <ChevronsLeft />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Next review page"
              disabled={page >= pages.length}
              onclick={() => updateRoute({ page: String(page + 1) })}
            >
              <ChevronsRight />
            </Button>
          </div>
        </nav>
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
