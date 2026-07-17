<script lang="ts">
  import { onDestroy } from "svelte";
  import { DateTime } from "luxon";
  import ChevronsLeft from "lucide-svelte/icons/chevrons-left";
  import ChevronsRight from "lucide-svelte/icons/chevrons-right";
  import ExternalLink from "lucide-svelte/icons/external-link";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type {
    IngestionRunPage,
    IngestionRunSummary,
  } from "../ingestion/types";
  import { useNavigation } from "../router/router";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";

  const PAGE_SIZES = [25, 50, 100];
  const DEFAULT_PAGE_SIZE = 25;
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const { snapshot } = useStudioWorkspace();
  const { router } = useNavigation();

  let page = $state<IngestionRunPage>({
    runs: [],
    total: 0,
    offset: 0,
    limit: DEFAULT_PAGE_SIZE,
  });
  let loading = $state(false);
  let status = $state("");
  let loadedProjectId = $state("");
  let pageSize = $state(DEFAULT_PAGE_SIZE);

  const project = $derived($snapshot);
  const pageNumber = $derived(Math.floor(page.offset / page.limit) + 1);
  const pageCount = $derived(Math.max(1, Math.ceil(page.total / page.limit)));
  const historyGroups = $derived.by(() => groupRunsByDate(page.runs));

  type HistoryDateGroup = {
    key: string;
    date: DateTime;
    runs: IngestionRunSummary[];
  };

  function historyPath(projectId: string, offset: number, limit: number) {
    const query = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    });
    return ingestionPath(projectId, `/runs?${query}`);
  }

  async function loadHistory(offset = 0, limit = pageSize) {
    if (!project || isWeb) return;
    loading = true;
    try {
      page = await ingestionJson<IngestionRunPage>(
        historyPath(project.project.id, offset, limit),
      );
      status = "";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  function changePageSize(value: string) {
    const next = Number(value);
    if (!PAGE_SIZES.includes(next) || next === pageSize) return;
    pageSize = next;
    void loadHistory(0, next);
  }

  function openInReview(summary: IngestionRunSummary) {
    router.push(
      `/records?${new URLSearchParams({
        sourceId: summary.sourceId.split(":")[0] ?? summary.sourceId,
        runId: summary.id,
      })}`,
    );
  }

  function formatTime(value: string) {
    const date = DateTime.fromISO(value, { zone: "utc" });
    return date.isValid ? date.toFormat("HH:mm 'UTC'") : value;
  }

  function groupRunsByDate(
    runs: readonly IngestionRunSummary[],
  ): HistoryDateGroup[] {
    const groups = new Map<string, HistoryDateGroup>();
    for (const run of runs) {
      const date = DateTime.fromISO(run.completedAt, { zone: "utc" });
      const key = date.isValid ? date.toISODate()! : run.completedAt;
      const group = groups.get(key);
      if (group) group.runs.push(run);
      else groups.set(key, { key, date, runs: [run] });
    }
    return [...groups.values()];
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
  });

  $effect(() => {
    if (isWeb || !project) {
      ingestionHeaderActions.set(null);
      return;
    }
    ingestionHeaderActions.set({ kind: "history", runCount: page.total });
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
          class="hidden grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto] items-center gap-3 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid"
        >
          <span>Import</span>
          <span class="text-right">Outcomes</span>
          <span>Actions</span>
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
                <article
                  class:rounded-b-xl={index === group.runs.length - 1}
                  class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b px-[15px] py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)_auto]"
                >
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="truncate text-sm font-semibold">
                        {run.sourceId}
                      </h3>
                      <span
                        class={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          run.reviewState === "pending"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {run.reviewState === "pending"
                          ? "Pending review"
                          : "Completed"}
                      </span>
                    </div>
                    <p class="mt-1 truncate text-xs text-muted-foreground">
                      {formatTime(run.completedAt)} · Run {run.id}
                    </p>
                  </div>

                  <div
                    class="order-2 flex flex-wrap justify-end gap-x-2 gap-y-1 sm:order-3"
                  >
                    {#if run.reviewState === "pending"}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onclick={() => openInReview(run)}
                      >
                        <ExternalLink data-icon="inline-start" />
                        <span class="hidden lg:inline">Open in Review</span>
                        <span class="lg:hidden">Review</span>
                      </Button>
                    {/if}
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onclick={() => router.push(`/import/history/${run.id}`)}
                    >
                      View audit
                    </Button>
                  </div>

                  <div
                    class="order-3 col-span-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground sm:order-2 sm:col-span-1 sm:justify-end"
                  >
                    <span class="font-medium tabular-nums text-foreground"
                      >{run.summary.total} proposals</span
                    >
                    <span class="tabular-nums"
                      >{run.summary.accepted} accepted</span
                    >
                    <span class="tabular-nums"
                      >{run.summary.needsReview} review</span
                    >
                    <span class="tabular-nums"
                      >{run.summary.duplicates} duplicates</span
                    >
                  </div>
                </article>
              {/each}
            </div>
          </section>
        {/each}

        {#if pageCount > 1}
          <nav
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
            aria-label="Import history pages"
          >
            <span class="text-sm text-muted-foreground"
              >Page {pageNumber} of {pageCount}</span
            >
            <div class="flex items-center gap-2">
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
              <Button
                size="icon"
                variant="outline"
                aria-label="Previous import history page"
                disabled={pageNumber <= 1 || loading}
                onclick={() =>
                  void loadHistory(Math.max(0, page.offset - page.limit))}
              >
                <ChevronsLeft />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Next import history page"
                disabled={pageNumber >= pageCount || loading}
                onclick={() => void loadHistory(page.offset + page.limit)}
              >
                <ChevronsRight />
              </Button>
            </div>
          </nav>
        {/if}
      {/if}
    </div>
  {/if}
</div>
