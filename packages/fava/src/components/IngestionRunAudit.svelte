<script lang="ts">
  import { onDestroy } from "svelte";
  import { DateTime } from "luxon";
  import ArrowLeft from "lucide-svelte/icons/arrow-left";
  import Check from "lucide-svelte/icons/check";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronUp from "lucide-svelte/icons/chevron-up";
  import CircleX from "lucide-svelte/icons/circle-x";
  import ChevronsLeft from "lucide-svelte/icons/chevrons-left";
  import ChevronsRight from "lucide-svelte/icons/chevrons-right";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type { ImportProposal, IngestionRun } from "../ingestion/types";
  import { useNavigation } from "../router/router";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import IngestionProposalSheet from "./IngestionProposalSheet.svelte";

  const PAGE_SIZES = [25, 50, 100];
  const { snapshot } = useStudioWorkspace();
  const { activeRoute, router } = useNavigation();
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";

  type ProposalRow = {
    key: string;
    proposal: ImportProposal;
  };

  type DateGroup = {
    key: string;
    label: string;
    rows: ProposalRow[];
  };

  let run = $state<IngestionRun | undefined>(undefined);
  let loading = $state(false);
  let status = $state("");
  let loadedSignature = $state("");
  let expandedGroups = $state(new Set<string>());
  let expandedSignature = $state("");
  let selectedRow = $state<ProposalRow | undefined>(undefined);
  let sheetOpen = $state(false);
  let failedLogoIds = $state(new Set<string>());

  const project = $derived($snapshot);
  const runId = $derived($activeRoute.params.runId ?? "");
  const queryProposalId = $derived($activeRoute.query.proposalId ?? "");
  const rows = $derived.by((): ProposalRow[] =>
    (run?.proposals ?? []).map((proposal) => ({
      key: `${run?.id ?? "run"}:${proposal.id}`,
      proposal,
    })),
  );
  const dateGroups = $derived.by((): DateGroup[] => {
    const buckets = new Map<string, ProposalRow[]>();
    for (const row of rows) {
      const date = row.proposal.transaction?.bookedAt ?? "unknown";
      const list = buckets.get(date) ?? [];
      list.push(row);
      buckets.set(date, list);
    }
    return [...buckets.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, groupedRows]) => ({
        key: date,
        label: formatGroupDate(date),
        rows: groupedRows.sort((left, right) =>
          (right.proposal.transaction?.amount ?? "").localeCompare(
            left.proposal.transaction?.amount ?? "",
          ),
        ),
      }));
  });
  const pageSize = $derived(
    PAGE_SIZES.includes(Number($activeRoute.query.pageSize))
      ? Number($activeRoute.query.pageSize)
      : 50,
  );
  const pages = $derived(paginateProposalGroups(dateGroups, pageSize));
  const requestedPage = $derived(
    Math.max(1, Number($activeRoute.query.page) || 1),
  );
  const page = $derived(Math.min(requestedPage, Math.max(1, pages.length)));
  const visibleGroups = $derived(pages[page - 1] ?? []);
  const groupsCollapsedAll = $derived(
    dateGroups.every((group) => !expandedGroups.has(group.key)),
  );
  const summaryLine = $derived.by(() => {
    if (!run) return "";
    const { summary } = run;
    return `${summary.ready} ready · ${summary.needsReview} need review · ${summary.accepted} accepted · ${summary.duplicates} duplicates`;
  });

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

  async function loadRun() {
    if (!project || isWeb || !runId) return;
    const signature = `${project.project.id}:${runId}`;
    if (signature === loadedSignature) return;
    loadedSignature = signature;
    loading = true;
    selectedRow = undefined;
    try {
      run = await ingestionJson<IngestionRun>(
        ingestionPath(project.project.id, `/runs/${encodeURIComponent(runId)}`),
      );
      status = "";
    } catch (error) {
      run = undefined;
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  function formatGroupDate(date: string) {
    if (date === "unknown") return "UNKNOWN DATE";
    const parsed = DateTime.fromISO(date, { zone: "utc" });
    return parsed.isValid
      ? parsed.toFormat("LLLL dd, yyyy").toUpperCase()
      : date.toUpperCase();
  }

  function formatDateTime(value: string) {
    const date = DateTime.fromISO(value, { zone: "utc" });
    return date.isValid ? date.toFormat("dd LLL yyyy, HH:mm 'UTC'") : value;
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
    const acceptance = proposal.acceptance
      ? ` · accepted into ${proposal.acceptance.destinationPath}`
      : "";
    const aiError =
      proposal.lastAiEnrichment?.ok === false ? " · AI error" : "";
    return `${proposal.status} · ${category}${acceptance}${aiError}`;
  }

  function rowAmount(proposal: ImportProposal) {
    const transaction = proposal.transaction;
    return transaction ? `${transaction.amount} ${transaction.currency}` : "—";
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

  function toggleAllGroups() {
    expandedGroups = groupsCollapsedAll
      ? new Set(dateGroups.map((group) => group.key))
      : new Set();
  }

  function openRow(row: ProposalRow) {
    updateRoute({ proposalId: row.proposal.id });
  }

  function closeProposalSheet() {
    if (queryProposalId) updateRoute({ proposalId: undefined });
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

  $effect(() => {
    if (!project || isWeb || !runId) return;
    void loadRun();
  });

  $effect(() => {
    const signature = dateGroups.map((group) => group.key).join("|");
    if (!signature || signature === expandedSignature) return;
    expandedSignature = signature;
    expandedGroups = new Set(dateGroups.map((group) => group.key));
  });

  $effect(() => {
    if (!queryProposalId) {
      if (sheetOpen) sheetOpen = false;
      return;
    }
    const row = rows.find((item) => item.proposal.id === queryProposalId);
    if (!row) return;
    selectedRow = row;
    sheetOpen = true;
  });

  $effect(() => ingestionHeaderActions.set(null));
  onDestroy(() => ingestionHeaderActions.set(null));
</script>

<div class="h-full overflow-auto p-3 sm:p-5" data-ingestion-run-audit>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    {#if isWeb}
      <div class="rounded-md border p-4 text-sm text-muted-foreground">
        Import audit history is available when Studio has access to the project
        folder.
      </div>
    {:else if !project}
      <div class="rounded-md border p-4 text-sm text-muted-foreground">
        Open a project to view this import run.
      </div>
    {:else}
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onclick={() => router.push("/import/history")}
        >
          <ArrowLeft data-icon="inline-start" />
          Import history
        </Button>
        {#if run}
          <span class="text-xs tabular-nums text-muted-foreground">
            Run {run.id}
          </span>
        {/if}
      </div>

      {#if status}
        <p
          class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {status}
        </p>
      {/if}

      {#if loading}
        <div class="rounded-xl border p-6 text-sm text-muted-foreground">
          Loading import audit…
        </div>
      {:else if run}
        <section class="rounded-2xl border bg-card px-5 py-4 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="truncate text-base font-semibold">{run.sourceId}</p>
              <p class="mt-1 text-sm text-muted-foreground">
                Completed {formatDateTime(run.completedAt)}
              </p>
            </div>
            <span class="text-sm tabular-nums text-muted-foreground">
              {run.summary.total} proposal{run.summary.total === 1 ? "" : "s"}
            </span>
          </div>
          <p class="mt-3 text-sm text-muted-foreground">{summaryLine}</p>
        </section>

        {#if run.audit?.ai.length}
          <section class="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div class="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 class="text-sm font-semibold">AI call audit</h2>
                <p class="mt-1 text-xs text-muted-foreground">
                  {run.audit.ai.length} call{run.audit.ai.length === 1
                    ? ""
                    : "s"} captured for this run.
                </p>
              </div>
            </div>
            <div class="border-t px-5 py-4">
              <div class="flex flex-col gap-3">
                {#each run.audit.ai as call (`${call.id}:${call.at}`)}
                  <details class="rounded-xl border bg-muted/30 px-4 py-3">
                    <summary class="cursor-pointer text-sm font-medium">
                      <span class="inline-flex items-center gap-2">
                        {#if call.ok}
                          <Check
                            class="size-4 text-green-600 dark:text-green-500"
                          />
                        {:else}
                          <CircleX class="size-4 text-destructive" />
                        {/if}
                        {call.label}
                      </span>
                      <span
                        class="ml-2 text-xs font-normal text-muted-foreground"
                      >
                        {formatDateTime(call.at)}
                        {#if call.batchSize}
                          · {call.batchSize} item{call.batchSize === 1
                            ? ""
                            : "s"}
                        {/if}
                        {#if call.durationMs !== undefined}
                          · {(call.durationMs / 1000).toFixed(1)}s
                        {/if}
                      </span>
                    </summary>
                    <div class="mt-3 flex flex-col gap-3">
                      {#if call.prompt}
                        <div>
                          <p
                            class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Prompt
                          </p>
                          <pre
                            class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-background p-3 text-xs">{call.prompt}</pre>
                        </div>
                      {/if}
                      {#if call.response}
                        <div>
                          <p
                            class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
                          >
                            Response
                          </p>
                          <pre
                            class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-background p-3 text-xs">{call.response}</pre>
                        </div>
                      {/if}
                      {#if call.error}
                        <div>
                          <p
                            class="mb-1 text-xs font-medium uppercase tracking-wide text-destructive"
                          >
                            Error
                          </p>
                          <pre
                            class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{call.error}</pre>
                        </div>
                      {/if}
                    </div>
                  </details>
                {/each}
              </div>
            </div>
          </section>
        {/if}

        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-semibold">Proposals</h2>
            <p class="text-sm text-muted-foreground">
              Select a proposal to inspect its retained workflow and merchant
              context.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onclick={toggleAllGroups}
          >
            {groupsCollapsedAll ? "Expand dates" : "Collapse dates"}
          </Button>
        </div>

        <div
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <span>Date</span>
          <span class="text-right">Amount</span>
        </div>

        {#if !dateGroups.length}
          <Empty.Root class="border">
            <Empty.Header>
              <Empty.Title>No proposals in this run</Empty.Title>
              <Empty.Description>
                This archived import did not retain any proposals.
              </Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/if}

        {#each visibleGroups as group (group.key)}
          {@const expanded = expandedGroups.has(group.key)}
          {@const groupId = `ingestion-audit-group-${group.key}`}
          {@const summaryId = `ingestion-audit-summary-${group.key}`}
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
                    aria-label={`Inspect ${rowTitle(row.proposal)}`}
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
                    <span class="text-sm font-semibold tabular-nums"
                      >{rowAmount(row.proposal)}</span
                    >
                  </div>
                {/each}
              </div>
            {/if}
          </section>
        {/each}

        {#if pages.length > 1}
          <nav
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
            aria-label="Import audit pages"
          >
            <span class="text-sm text-muted-foreground"
              >Page {page} of {pages.length}</span
            >
            <div class="flex items-center gap-2">
              <label
                class="text-sm text-muted-foreground"
                for="ingestion-audit-page-size">Records per page</label
              >
              <select
                id="ingestion-audit-page-size"
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
                aria-label="Previous import audit page"
                disabled={page <= 1}
                onclick={() => updateRoute({ page: String(page - 1) })}
              >
                <ChevronsLeft />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Next import audit page"
                disabled={page >= pages.length}
                onclick={() => updateRoute({ page: String(page + 1) })}
              >
                <ChevronsRight />
              </Button>
            </div>
          </nav>
        {/if}
      {:else if !status}
        <Empty.Root class="border">
          <Empty.Header>
            <Empty.Title>Import run not found</Empty.Title>
            <Empty.Description>
              This run may have been removed from the local archive.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {/if}
    {/if}
  </div>
</div>

{#if selectedRow && project && run}
  {#key selectedRow.key}
    <IngestionProposalSheet
      bind:open={sheetOpen}
      proposal={selectedRow.proposal}
      runId={run.id}
      projectId={project.project.id}
      readOnly
      onClosed={closeProposalSheet}
    />
  {/key}
{/if}
