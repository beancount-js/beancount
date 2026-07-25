<script lang="ts">
  import { accountOpenClose } from "@beancount-js/beancount";
  import { onDestroy } from "svelte";
  import { DateTime } from "luxon";
  import SharedIngestionRunHistory, {
    type IngestionRunHistoryGroup,
    type IngestionRunHistoryRow,
    type IngestionRunHistorySortKey,
    type IngestionRunHistorySortOrder,
  } from "@lapis/ui/pages/IngestionRunHistory.svelte";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type {
    IngestionConfigResponse,
    IngestionRunPage,
    IngestionRunSummary,
  } from "../ingestion/types";
  import { useContext } from "../context";
  import { urlForAccount } from "../helpers";
  import {
    ingestionHistoryRowPath,
    ingestionRunSourceDisplay,
  } from "../ingestion/history";
  import { useNavigation } from "../router/router";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";

  const PAGE_SIZES = [25, 50, 100];
  const DEFAULT_PAGE_SIZE = 25;
  const ALL_CONNECTIONS = "__all__";
  const SORT_CYCLE: Record<
    IngestionRunHistorySortOrder,
    IngestionRunHistorySortOrder
  > = {
    none: "asc",
    asc: "desc",
    desc: "none",
  };
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const { snapshot } = useStudioWorkspace();
  const { ledgerData } = useContext();
  const { activeRoute, router } = useNavigation();

  type ConnectionMerchant = {
    merchantId: string;
    logoUrl?: string;
  };

  let page = $state<IngestionRunPage>({
    runs: [],
    total: 0,
    offset: 0,
    limit: DEFAULT_PAGE_SIZE,
  });
  let loading = $state(false);
  let status = $state("");
  let loadedProjectId = $state("");
  let sourceConfig = $state<IngestionConfigResponse | undefined>(undefined);
  let sourceId = $state(ALL_CONNECTIONS);
  let merchantsById = $state<Record<string, ConnectionMerchant>>({});
  let pageSize = $state(DEFAULT_PAGE_SIZE);
  let sortOrders = $state<
    Record<IngestionRunHistorySortKey, IngestionRunHistorySortOrder>
  >({
    date: "none",
    proposals: "none",
    accepted: "none",
    review: "none",
    duplicates: "none",
  });
  let sortPriority = $state<IngestionRunHistorySortKey[]>([]);

  const project = $derived($snapshot);
  const querySourceId = $derived($activeRoute?.query?.sourceId ?? "");
  const sourceOptions = $derived([
    { value: ALL_CONNECTIONS, label: "All connections" },
    ...(sourceConfig?.sources ?? []).map((source) => ({
      value: source.id,
      label: `${source.name}${source.credentialAvailable ? "" : " (credential unavailable)"}`,
    })),
  ]);
  const pageNumber = $derived(Math.floor(page.offset / page.limit) + 1);
  const pageCount = $derived(Math.max(1, Math.ceil(page.total / page.limit)));
  const historyGroups = $derived.by(() =>
    groupRunsByDate(page.runs, sortPriority, sortOrders),
  );
  const openDirectivesByAccount = $derived.by(() =>
    accountOpenClose($ledgerData.directives),
  );
  const uiGroups = $derived<IngestionRunHistoryGroup[]>(
    historyGroups.map((group) => ({
      key: group.key,
      label: groupDate(group),
      runs: group.runs.map(uiRun),
    })),
  );

  type HistoryDateGroup = {
    key: string;
    date: DateTime;
    runs: IngestionRunSummary[];
  };

  function historyPath(
    projectId: string,
    offset: number,
    limit: number,
    nextSourceId = sourceId,
  ) {
    const query = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    if (nextSourceId !== ALL_CONNECTIONS) query.set("sourceId", nextSourceId);
    return ingestionPath(projectId, `/runs?${query}`);
  }

  async function loadHistory(
    offset = 0,
    limit = pageSize,
    nextSourceId = sourceId,
  ) {
    if (!project || isWeb) return;
    loading = true;
    try {
      page = await ingestionJson<IngestionRunPage>(
        historyPath(project.project.id, offset, limit, nextSourceId),
      );
      status = "";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function loadSourceConfig(projectId: string) {
    try {
      const next = await ingestionJson<IngestionConfigResponse>(
        ingestionPath(projectId),
      );
      if ($snapshot?.project.id !== projectId) return;
      sourceConfig = next;
      void loadMerchants(projectId);

      const requestedSourceId = querySourceId;
      const nextSourceId =
        requestedSourceId === ALL_CONNECTIONS ||
        next.sources.some((source) => source.id === requestedSourceId)
          ? requestedSourceId
          : ALL_CONNECTIONS;
      if (sourceId !== nextSourceId) {
        sourceId = nextSourceId;
        void loadHistory(0, pageSize, nextSourceId);
      }
    } catch {
      if ($snapshot?.project.id === projectId) sourceConfig = undefined;
    }
  }

  async function loadMerchants(projectId: string) {
    try {
      const merchants = await ingestionJson<ConnectionMerchant[]>(
        ingestionPath(projectId, "/merchants"),
      );
      if ($snapshot?.project.id !== projectId) return;
      merchantsById = Object.fromEntries(
        merchants.map((merchant) => [merchant.merchantId, merchant]),
      );
    } catch {
      if ($snapshot?.project.id === projectId) merchantsById = {};
    }
  }

  function merchantFor(sourceMerchantId?: string) {
    return sourceMerchantId ? merchantsById[sourceMerchantId] : undefined;
  }

  function accountAppearanceFor(sourceAccount?: string) {
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

  function changePageSize(next: number) {
    if (!PAGE_SIZES.includes(next) || next === pageSize) return;
    pageSize = next;
    void loadHistory(0, next);
  }

  function historyRoutePath(nextSourceId: string) {
    const query = new URLSearchParams($activeRoute?.query ?? {});
    if (nextSourceId === ALL_CONNECTIONS) query.delete("sourceId");
    else query.set("sourceId", nextSourceId);
    const suffix = query.toString();
    return suffix ? `/import/history?${suffix}` : "/import/history";
  }

  function changeSource(nextSourceId: string) {
    if (nextSourceId === sourceId) return;
    sourceId = nextSourceId;
    router.push(historyRoutePath(nextSourceId));
    void loadHistory(0, pageSize, nextSourceId);
  }

  function handleRunLinkClick(event: MouseEvent, runId: string) {
    const summary = page.runs.find((run) => run.id === runId);
    if (!summary) return;
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    event.preventDefault();
    router.push(ingestionHistoryRowPath(summary));
  }

  function formatTime(value: string) {
    const date = DateTime.fromISO(value, { zone: "utc" });
    return date.isValid ? date.toFormat("HH:mm 'UTC'") : value;
  }

  function cycleSort(key: IngestionRunHistorySortKey) {
    const next = SORT_CYCLE[sortOrders[key]];
    sortOrders = { ...sortOrders, [key]: next };
    if (next === "none") {
      sortPriority = sortPriority.filter((item) => item !== key);
    } else if (!sortPriority.includes(key)) {
      sortPriority = [...sortPriority, key];
    }
  }

  function groupRunsByDate(
    runs: readonly IngestionRunSummary[],
    priority: readonly IngestionRunHistorySortKey[],
    orders: Readonly<
      Record<IngestionRunHistorySortKey, IngestionRunHistorySortOrder>
    >,
  ): HistoryDateGroup[] {
    const groups = new Map<string, HistoryDateGroup>();
    for (const run of runs) {
      const date = DateTime.fromISO(run.completedAt, { zone: "utc" });
      const key = date.isValid ? date.toISODate()! : run.completedAt;
      const group = groups.get(key);
      if (group) group.runs.push(run);
      else groups.set(key, { key, date, runs: [run] });
    }

    const activeSorts = priority.filter((key) => orders[key] !== "none");
    const runSorts = activeSorts.filter((key) => key !== "date");
    const sortedGroups = [...groups.values()];

    for (const group of sortedGroups) {
      if (!runSorts.length) continue;
      group.runs.sort((left, right) =>
        compareRuns(left, right, runSorts, orders),
      );
    }

    const dateOrder = orders.date;
    if (dateOrder !== "none") {
      const direction = dateOrder === "asc" ? 1 : -1;
      sortedGroups.sort(
        (left, right) =>
          direction * (left.date.toMillis() - right.date.toMillis()),
      );
    }

    return sortedGroups;
  }

  function compareRuns(
    left: IngestionRunSummary,
    right: IngestionRunSummary,
    keys: readonly IngestionRunHistorySortKey[],
    orders: Readonly<
      Record<IngestionRunHistorySortKey, IngestionRunHistorySortOrder>
    >,
  ) {
    for (const key of keys) {
      const direction = orders[key] === "asc" ? 1 : -1;
      const result =
        key === "proposals"
          ? left.summary.total - right.summary.total
          : key === "accepted"
            ? left.summary.accepted - right.summary.accepted
            : key === "review"
              ? left.summary.needsReview - right.summary.needsReview
              : key === "duplicates"
                ? left.summary.duplicates - right.summary.duplicates
                : 0;
      if (result !== 0) return direction * result;
    }
    return 0;
  }

  function groupDate(group: HistoryDateGroup) {
    return group.date.isValid
      ? group.date.toFormat("LLLL dd, yyyy").toUpperCase()
      : group.key;
  }

  function uiRun(run: IngestionRunSummary): IngestionRunHistoryRow {
    const source = ingestionRunSourceDisplay(
      run.sourceId,
      sourceConfig?.sources ?? [],
    );
    const appearance = accountAppearanceFor(source.sourceAccount);
    const accountMerchant = merchantFor(appearance.merchantId);
    const sourceMerchant = merchantFor(source.sourceMerchantId);
    return {
      id: run.id,
      href: ingestionHistoryRowPath(run),
      sourceTitle: source.title,
      sourceName: source.sourceName,
      sourceAccount: source.sourceAccount,
      sourceAccountHref: source.sourceAccount
        ? urlForAccount(source.sourceAccount)
        : undefined,
      sourceAccountColor: appearance.color,
      sourceAccountIcon: appearance.icon,
      accountMerchantLogoUrl: accountMerchant?.logoUrl,
      sourceMerchantId: sourceMerchant?.merchantId,
      sourceMerchantLogoUrl: sourceMerchant?.logoUrl,
      reviewState: run.reviewState,
      completedAtLabel: formatTime(run.completedAt),
      total: run.summary.total,
      accepted: run.summary.accepted,
      needsReview: run.summary.needsReview,
      duplicates: run.summary.duplicates,
    };
  }

  $effect(() => {
    const next = project;
    if (!next || isWeb || next.project.id === loadedProjectId) return;
    loadedProjectId = next.project.id;
    void loadHistory();
    void loadSourceConfig(next.project.id);
  });

  $effect(() => {
    if (isWeb || !project) {
      ingestionHeaderActions.set(null);
      return;
    }
    ingestionHeaderActions.set({
      kind: "history",
      runCount: page.total,
      sourceId,
      sourceOptions,
      onSourceChange: changeSource,
    });
  });

  onDestroy(() => ingestionHeaderActions.set(null));
</script>

<SharedIngestionRunHistory
  {isWeb}
  hasProject={Boolean(project)}
  {loading}
  {status}
  groups={uiGroups}
  {sortOrders}
  page={pageNumber}
  {pageCount}
  {pageSize}
  pageSizeOptions={PAGE_SIZES}
  onCycleSort={cycleSort}
  onRunLinkClick={handleRunLinkClick}
  onPageChange={(nextPage) => void loadHistory((nextPage - 1) * page.limit)}
  onPageSizeChange={changePageSize}
/>
