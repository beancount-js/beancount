<script lang="ts">
  import { DateTime } from "luxon";
  import type { IngestionSyncJob } from "@beancount-js/server";
  import type { ProjectSnapshot } from "@beancount-js/workspace";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronUp from "lucide-svelte/icons/chevron-up";
  import { useStudioWorkspace } from "../studio/workspace";
  import { useNavigation } from "../router/router";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    latestIngestionSyncJob,
    subscribeIngestionSyncEvents,
  } from "../ingestion/sync";
  import type {
    IngestionConfigResponse,
    IngestionRun,
    ImportProposal,
  } from "../ingestion/types";
  import { Button } from "$lib/components/ui/button";
  import * as Alert from "$lib/components/ui/alert";
  import IngestionProposalSheet from "./IngestionProposalSheet.svelte";

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

  const { snapshot } = useStudioWorkspace();
  const { activeRoute, router } = useNavigation();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  let config = $state<IngestionConfigResponse | undefined>(undefined);
  let runs = $state<IngestionRun[]>([]);
  let activeRuns = $state<IngestionRun[]>([]);
  let sourceId = $state("");
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

  const project = $derived($snapshot);
  const querySourceId = $derived($activeRoute?.query?.sourceId ?? "");
  const queryRunId = $derived($activeRoute?.query?.runId ?? "");
  const selectedSource = $derived(
    config?.sources.find((source) => source.id === sourceId),
  );
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

  const accepted = $derived(
    proposalRows.filter(
      (row) =>
        row.proposal.status === "ready" && row.proposal.selectedAccount,
    ),
  );

  const dateGroups = $derived.by((): DateGroup[] => {
    const buckets = new Map<string, ProposalRow[]>();
    for (const row of proposalRows) {
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

  $effect(() => {
    const signature = dateGroups.map((group) => group.key).join("|");
    if (!signature || signature === expandedSignature) return;
    expandedSignature = signature;
    expandedGroups = new Set(dateGroups[0] ? [dateGroups[0].key] : []);
  });

  $effect(() => {
    const next = project;
    if (next && !isWeb && next.project.id !== loadedProjectId) {
      void refresh();
    }
  });

  function runBelongsToSource(item: IngestionRun, id: string) {
    return item.sourceId === id || item.sourceId.startsWith(`${id}:`);
  }

  function reviewableCount(run: IngestionRun) {
    return run.proposals.filter(
      (proposal) =>
        proposal.status === "ready" || proposal.status === "needs-review",
    ).length;
  }

  function sortRunsNewest(items: IngestionRun[]) {
    return [...items].sort((a, b) =>
      (b.completedAt || b.startedAt).localeCompare(
        a.completedAt || a.startedAt,
      ),
    );
  }

  function pickRunsForSource(
    items: IngestionRun[],
    id: string,
    preferredRunId?: string,
    syncRunIds?: readonly string[],
  ) {
    const belonging = items.filter((item) => runBelongsToSource(item, id));
    if (!belonging.length) return [];

    if (preferredRunId) {
      const preferred = belonging.find((item) => item.id === preferredRunId);
      if (preferred) return [preferred];
    }

    if (syncRunIds?.length) {
      const fromSync = syncRunIds
        .map((runId) => belonging.find((item) => item.id === runId))
        .filter((item): item is IngestionRun => Boolean(item));
      if (fromSync.length) return fromSync;
    }

    const sorted = sortRunsNewest(belonging);
    const reviewable = sorted.find((run) => reviewableCount(run) > 0);
    return reviewable ? [reviewable] : sorted[0] ? [sorted[0]] : [];
  }

  function applyActiveRuns(next: IngestionRun[]) {
    activeRuns = next;
    if (!next.length) {
      status = config?.sources.length
        ? "Sync from Accounts, then review proposals here."
        : "Add a JSON API source under Sources first.";
      return;
    }
    status = "";
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
        applyActiveRuns(
          pickRunsForSource(runs, id, undefined, latest.runIds),
        );
      }
    } catch {
      // Review page can still work without live sync status.
    }
  }

  async function refresh() {
    if (!project || isWeb) return;
    loading = true;
    try {
      const [configResponse, runList] = await Promise.all([
        ingestionJson<IngestionConfigResponse>(
          ingestionPath(project.project.id),
        ),
        ingestionJson<IngestionRun[]>(
          ingestionPath(project.project.id, "/runs"),
        ),
      ]);
      config = configResponse;
      runs = runList;
      const preferredSource =
        querySourceId &&
        config.sources.some((source) => source.id === querySourceId)
          ? querySourceId
          : sourceId;
      sourceId = config.sources.some((source) => source.id === preferredSource)
        ? preferredSource
        : (config.sources[0]?.id ?? "");
      let syncRunIds: string[] | undefined;
      if (sourceId) {
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
      applyActiveRuns(
        sourceId
          ? pickRunsForSource(
              runs,
              sourceId,
              queryRunId || undefined,
              syncRunIds,
            )
          : [],
      );
      loadedProjectId = project.project.id;
      if (sourceId) void watchSync(project.project.id, sourceId);
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function loadRunForSource(nextSourceId: string) {
    sourceId = nextSourceId;
    let syncRunIds: string[] | undefined;
    if (project) {
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
    applyActiveRuns(
      pickRunsForSource(runs, nextSourceId, undefined, syncRunIds),
    );
    if (!activeRuns.length) {
      status = "No import run yet. Sync this connection from Accounts.";
    }
    if (project) void watchSync(project.project.id, nextSourceId);
  }

  async function fetchTransactions() {
    if (!project || !sourceId) return;
    loading = true;
    try {
      const run = await ingestionJson<IngestionRun>(
        ingestionPath(project.project.id, "/runs"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sourceId }),
        },
      );
      runs = [run, ...runs.filter((item) => item.id !== run.id)];
      applyActiveRuns([run]);
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  function openAccounts() {
    router.push("/import/accounts");
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
    return `${proposal.status} · ${category}`;
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
    selectedRow = row;
    sheetOpen = true;
  }

  function handleRowKeydown(event: KeyboardEvent, row: ProposalRow) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRow(row);
    }
  }

  function markLogoFailed(proposalId: string) {
    failedLogoIds = new Set([...failedLogoIds, proposalId]);
  }

  async function accept() {
    if (!project || !accepted.length || !selectedSource) return;
    const destination =
      selectedSource.destinationPath ?? project.project.entryFile;
    const expectedRevision = project.revisions.find(
      (revision) => revision.path === destination,
    )?.revision;
    if (!expectedRevision) {
      status = "The configured destination is not an editable ledger file.";
      return;
    }
    loading = true;
    try {
      const byRun = new Map<string, string[]>();
      for (const row of accepted) {
        const list = byRun.get(row.runId) ?? [];
        list.push(row.proposal.id);
        byRun.set(row.runId, list);
      }
      let acceptedCount = 0;
      let lastSnapshot: ProjectSnapshot | undefined;
      for (const [runId, proposalIds] of byRun) {
        const result = await ingestionJson<{
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
        lastSnapshot = result.snapshot;
        replaceRun(result.run);
        acceptedCount += proposalIds.length;
      }
      if (lastSnapshot) snapshot.set(lastSnapshot);
      status = `Accepted ${acceptedCount} transaction${acceptedCount === 1 ? "" : "s"}.`;
      sheetOpen = false;
      selectedRow = undefined;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }
</script>

<div
  class="h-full overflow-auto p-3 sm:p-5"
  data-ingestion-review
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    <div>
      <h1 class="text-xl font-semibold">Review imports</h1>
      <p class="text-sm text-muted-foreground">
        Sync from Accounts, review proposals, then accept into the ledger.
      </p>
    </div>

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
    {:else}
      <div class="flex flex-wrap items-end gap-3 rounded-md border p-4">
        <label class="grid gap-1 text-sm">
          <span>Source</span>
          <select
            class="min-w-64 rounded border bg-background px-2 py-1"
            value={sourceId}
            onchange={(event) =>
              void loadRunForSource(
                (event.currentTarget as HTMLSelectElement).value,
              )}
          >
            {#each config?.sources ?? [] as source (source.id)}
              <option value={source.id}
                >{source.name}{source.credentialAvailable
                  ? ""
                  : " (credential unavailable)"}</option
              >
            {/each}
          </select>
        </label>
        <Button type="button" variant="outline" onclick={openAccounts}>
          Open Accounts
        </Button>
        <button
          class="rounded border px-3 py-2 text-sm text-muted-foreground disabled:opacity-50"
          disabled={!sourceId ||
            loading ||
            syncing ||
            !selectedSource?.credentialAvailable}
          title="Prefer Sync on the Accounts screen"
          onclick={fetchTransactions}>Force re-fetch</button
        >
        <a class="rounded border px-3 py-2 text-sm" href="/import/editor"
          >Edit sources</a
        >
      </div>
    {/if}

    {#if syncing}
      <Alert.Root>
        <Alert.Title>Sync in progress</Alert.Title>
        <Alert.Description>
          {syncJob?.progress.message || "Fetching transactions from Accounts…"}
          Accept is disabled until the sync finishes.
        </Alert.Description>
      </Alert.Root>
    {/if}

    {#if status}<p class="text-sm text-muted-foreground">{status}</p>{/if}

    {#if activeRuns.length}
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold">Review</h2>
          {#if summaryLine}
            <p class="text-sm text-muted-foreground">{summaryLine}</p>
          {/if}
        </div>
        <button
          class="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={!accepted.length || loading || syncing}
          onclick={accept}
          >Accept {accepted.length} reviewed transaction{accepted.length === 1
            ? ""
            : "s"}</button
        >
      </div>

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
          No proposals in this import run.
        </div>
      {/if}

      {#each dateGroups as group (group.key)}
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
                    <div class="mt-1 truncate text-xs text-muted-foreground">
                      {rowDetail(row.proposal)}
                    </div>
                  </div>
                  <span class="text-sm font-semibold tabular-nums">
                    {rowAmount(row.proposal)}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    {/if}
  </div>
</div>

{#if selectedRow && project}
  <IngestionProposalSheet
    bind:open={sheetOpen}
    proposal={selectedRow.proposal}
    runId={selectedRow.runId}
    projectId={project.project.id}
    {allowedAccounts}
    onUpdated={replaceRun}
    onStatus={(message) => (status = message)}
  />
{/if}
