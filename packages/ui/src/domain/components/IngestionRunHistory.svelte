<script lang="ts">
  import { accountOpenClose } from "@beancount-js/beancount";
  import AccountAvatar from "../../components/forms/AccountAvatar.svelte";
  import { accountAvatarInitial } from "../../components/forms/account-avatar";
  import { onDestroy } from "svelte";
  import { DateTime } from "luxon";
  import { ArrowDownWideNarrow } from "@lucide/svelte";
  import { ArrowUpDown } from "@lucide/svelte";
  import { ArrowUpNarrowWide } from "@lucide/svelte";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import type { SortOrder } from "../grid/sort";
  import { useIngestionApi, ingestionPath } from "../ingestion/api";
  const { ingestionJson } = useIngestionApi();
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
  import { useIngestionHeaderActions } from "../studio/ingestion-header-actions";
  const ingestionHeaderActions = useIngestionHeaderActions();
  import { useStudioWorkspace } from "../studio/workspace";
  import PagePagination from "./PagePagination.svelte";

  const PAGE_SIZES = [25, 50, 100];
  const DEFAULT_PAGE_SIZE = 25;
  const ALL_CONNECTIONS = "__all__";
  const SORT_CYCLE: Record<SortOrder, SortOrder> = {
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
  let failedMerchantLogoIds = $state(new Set<string>());
  let pageSize = $state(DEFAULT_PAGE_SIZE);
  let sortOrders = $state<Record<SortKey, SortOrder>>({
    date: "none",
    proposals: "none",
    accepted: "none",
    review: "none",
    duplicates: "none",
  });
  /** Order sorts were added; earlier entries are primary. */
  let sortPriority = $state<SortKey[]>([]);

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

  type SortKey = "date" | "proposals" | "accepted" | "review" | "duplicates";
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

  function markMerchantLogoFailed(merchantId: string) {
    failedMerchantLogoIds = new Set([...failedMerchantLogoIds, merchantId]);
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

  function changePageSize(value: string) {
    const next = Number(value);
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

  function handleRunLinkClick(event: MouseEvent, summary: IngestionRunSummary) {
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

  function cycleSort(key: SortKey) {
    const next = SORT_CYCLE[sortOrders[key]];
    sortOrders = { ...sortOrders, [key]: next };
    if (next === "none") {
      sortPriority = sortPriority.filter((item) => item !== key);
    } else if (!sortPriority.includes(key)) {
      sortPriority = [...sortPriority, key];
    }
  }

  function ariaSortFor(key: SortKey): "ascending" | "descending" | "none" {
    const order = sortOrders[key];
    if (order === "none") return "none";
    return order === "asc" ? "ascending" : "descending";
  }

  function groupRunsByDate(
    runs: readonly IngestionRunSummary[],
    priority: readonly SortKey[],
    orders: Readonly<Record<SortKey, SortOrder>>,
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
    keys: readonly SortKey[],
    orders: Readonly<Record<SortKey, SortOrder>>,
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

<div class="h-full overflow-auto p-3 sm:p-5" data-ingestion-history>
  {#if !project}
    <div class="rounded-md border p-4 text-sm text-muted-foreground">
      Open a project to view import history.
    </div>
  {:else if isWeb}
    <div class="rounded-md border p-4 text-sm text-muted-foreground">
      Import history is available when Studio has access to the project folder.
    </div>
  {:else}
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-4">
      {#if status}
        <p
          class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {status}
        </p>
      {/if}

      {#if loading && page.runs.length === 0}
        <div class="rounded-xl border p-6 text-sm text-muted-foreground">
          Loading archived runs…
        </div>
      {:else if page.runs.length === 0}
        <Empty.Root class="border">
          <Empty.Header>
            <Empty.Title>No import runs yet</Empty.Title>
            <Empty.Description>
              Completed and pending ingestion runs will appear here.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <div
          role="row"
          class="hidden grid-cols-[minmax(0,1fr)_repeat(4,5rem)] items-center gap-x-6 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid"
        >
          <div
            role="columnheader"
            aria-sort={ariaSortFor("date")}
            class="justify-self-start"
          >
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sort by date"
              onclick={() => cycleSort("date")}
            >
              Date
              {#if sortOrders.date === "asc"}
                <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
              {:else if sortOrders.date === "desc"}
                <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
              {:else}
                <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
              {/if}
            </button>
          </div>
          <div
            role="columnheader"
            aria-sort={ariaSortFor("proposals")}
            class="justify-self-center"
          >
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sort by proposal count"
              onclick={() => cycleSort("proposals")}
            >
              Proposals
              {#if sortOrders.proposals === "asc"}
                <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
              {:else if sortOrders.proposals === "desc"}
                <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
              {:else}
                <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
              {/if}
            </button>
          </div>
          <div
            role="columnheader"
            aria-sort={ariaSortFor("accepted")}
            class="justify-self-center"
          >
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sort by accepted count"
              onclick={() => cycleSort("accepted")}
            >
              Accepted
              {#if sortOrders.accepted === "asc"}
                <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
              {:else if sortOrders.accepted === "desc"}
                <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
              {:else}
                <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
              {/if}
            </button>
          </div>
          <div
            role="columnheader"
            aria-sort={ariaSortFor("review")}
            class="justify-self-center"
          >
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sort by review count"
              onclick={() => cycleSort("review")}
            >
              Review
              {#if sortOrders.review === "asc"}
                <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
              {:else if sortOrders.review === "desc"}
                <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
              {:else}
                <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
              {/if}
            </button>
          </div>
          <div
            role="columnheader"
            aria-sort={ariaSortFor("duplicates")}
            class="justify-self-center"
          >
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sort by duplicate count"
              onclick={() => cycleSort("duplicates")}
            >
              Duplicates
              {#if sortOrders.duplicates === "asc"}
                <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
              {:else if sortOrders.duplicates === "desc"}
                <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
              {:else}
                <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
              {/if}
            </button>
          </div>
        </div>

        {#each historyGroups as group (group.key)}
          <section
            class="overflow-hidden rounded-2xl bg-muted/80"
            aria-label={`Import runs from ${groupDate(group)}`}
          >
            <div class="px-5 py-4">
              <h2 class="text-sm font-semibold tracking-wide text-foreground">
                {groupDate(group)}
                <span class="ml-2 text-muted-foreground"
                  >· {group.runs.length}</span
                >
              </h2>
            </div>
            <div
              class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm"
            >
              {#each group.runs as run, index (run.id)}
                {@const source = ingestionRunSourceDisplay(
                  run.sourceId,
                  sourceConfig?.sources ?? [],
                )}
                {@const appearance = accountAppearanceFor(source.sourceAccount)}
                {@const accountMerchant = merchantFor(appearance.merchantId)}
                {@const sourceMerchant = merchantFor(source.sourceMerchantId)}
                <div
                  class:rounded-b-xl={index === group.runs.length - 1}
                  class="relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b px-4 py-4 transition-colors last:border-b-0 focus-within:bg-accent focus-within:ring-2 focus-within:ring-ring hover:bg-accent/60 sm:grid-cols-[minmax(0,1fr)_repeat(4,5rem)] sm:gap-x-6"
                >
                  <a
                    href={ingestionHistoryRowPath(run)}
                    class="absolute inset-0 z-0 rounded-[inherit] outline-none"
                    aria-label={`${
                      run.reviewState === "pending"
                        ? "Review"
                        : "View audit for"
                    } ${source.title}`}
                    onclick={(event) => handleRunLinkClick(event, run)}
                  ></a>

                  <div
                    class="pointer-events-none relative z-10 col-span-2 min-w-0 sm:col-span-1 sm:row-span-2"
                  >
                    <div class="flex min-w-0 items-start gap-3">
                      <AccountAvatar
                        account={source.sourceAccount ?? source.title}
                        color={appearance.color}
                        icon={appearance.icon}
                        merchantLogoUrl={accountMerchant?.logoUrl}
                      />
                      <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-center gap-2">
                          <h3 class="min-w-0 truncate text-sm font-semibold">
                            {source.title}
                          </h3>
                        </div>
                        {#if source.sourceAccount}
                          <a
                            class="pointer-events-auto relative z-10 mt-1 block truncate text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            href={urlForAccount(source.sourceAccount)}
                            title={source.sourceAccount}
                            >{source.sourceAccount}</a
                          >
                        {/if}
                      </div>
                    </div>
                  </div>

                  <div
                    class="pointer-events-none relative z-10 order-2 col-span-2 grid min-w-0 grid-cols-[6.75rem_1.25rem_4.5rem] items-center justify-end gap-2 sm:order-none sm:col-span-4 sm:col-start-2 sm:grid-cols-[6.75rem_8rem_4.5rem]"
                  >
                    <span
                      class={`justify-self-start rounded-full px-2 py-0.5 text-xs font-medium ${
                        run.reviewState === "pending"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {run.reviewState === "pending"
                        ? "Pending review"
                        : "Completed"}
                    </span>
                    <span
                      class="inline-flex size-5 items-center justify-center justify-self-start overflow-hidden rounded-full border border-border bg-muted text-[0.625rem] font-semibold text-muted-foreground sm:size-auto sm:max-w-32 sm:gap-1 sm:rounded-full sm:px-1 sm:py-0.5 sm:text-xs"
                      aria-label={`Source: ${source.sourceName}`}
                      title={`Source: ${source.sourceName}`}
                    >
                      {#if sourceMerchant?.logoUrl && !failedMerchantLogoIds.has(sourceMerchant.merchantId)}
                        <img
                          class="size-full object-cover sm:size-3.5 sm:rounded-full"
                          src={sourceMerchant.logoUrl}
                          alt=""
                          onerror={() =>
                            markMerchantLogoFailed(sourceMerchant.merchantId)}
                        />
                      {:else}
                        <span
                          class="grid size-full place-items-center bg-rose-200 text-rose-800 sm:size-3.5 sm:rounded-full"
                          aria-hidden="true"
                        >
                          {accountAvatarInitial(source.sourceName)}
                        </span>
                      {/if}
                      <span class="hidden min-w-0 truncate sm:inline"
                        >{source.sourceName}</span
                      >
                    </span>
                    <span
                      class="justify-self-end whitespace-nowrap text-xs text-muted-foreground"
                    >
                      {formatTime(run.completedAt)}
                    </span>
                  </div>

                  <div
                    class="pointer-events-none relative z-10 order-3 col-span-2 grid grid-cols-4 gap-3 text-center text-xs text-muted-foreground sm:order-none sm:col-span-4 sm:col-start-2 sm:gap-x-6 sm:text-sm"
                  >
                    <span
                      class="font-medium tabular-nums text-foreground sm:text-center"
                      aria-label={`${run.summary.total} proposals`}
                      >{run.summary.total}</span
                    >
                    <span
                      class="tabular-nums sm:text-center"
                      aria-label={`${run.summary.accepted} accepted`}
                      >{run.summary.accepted}</span
                    >
                    <span
                      class="tabular-nums sm:text-center"
                      aria-label={`${run.summary.needsReview} need review`}
                      >{run.summary.needsReview}</span
                    >
                    <span
                      class="tabular-nums sm:text-center"
                      aria-label={`${run.summary.duplicates} duplicates`}
                      >{run.summary.duplicates}</span
                    >
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/each}

        {#if pageCount > 1}
          <div
            class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-import-history-pagination
          >
            <span class="text-sm text-muted-foreground"
              >Page {pageNumber} of {pageCount}</span
            >
            <div
              class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"
            >
              <div class="hidden items-center gap-2 sm:flex">
                <label
                  class="text-sm text-muted-foreground"
                  for="history-page-size">Records per page</label
                >
                <select
                  id="history-page-size"
                  class="h-8 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onchange={(event) =>
                    changePageSize(
                      (event.currentTarget as HTMLSelectElement).value,
                    )}
                >
                  {#each PAGE_SIZES as size (size)}
                    <option value={size}>{size}</option>
                  {/each}
                </select>
              </div>
              <PagePagination
                page={pageNumber}
                {pageCount}
                ariaLabel="Import history pages"
                disabled={loading}
                onPageChange={(nextPage) =>
                  void loadHistory((nextPage - 1) * page.limit)}
              />
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>
