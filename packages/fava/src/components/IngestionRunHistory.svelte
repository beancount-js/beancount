<script lang="ts">
  import { DateTime } from "luxon";
  import Clock3 from "lucide-svelte/icons/clock-3";
  import ChevronLeft from "lucide-svelte/icons/chevron-left";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import ExternalLink from "lucide-svelte/icons/external-link";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type {
    IngestionRun,
    IngestionRunPage,
    IngestionRunSummary,
  } from "../ingestion/types";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";

  const PAGE_SIZE = 25;
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const { snapshot } = useStudioWorkspace();
  const { router } = useNavigation();

  let page = $state<IngestionRunPage>({
    runs: [],
    total: 0,
    offset: 0,
    limit: PAGE_SIZE,
  });
  let selectedRun = $state<IngestionRun | undefined>(undefined);
  let loading = $state(false);
  let detailLoading = $state(false);
  let status = $state("");
  let loadedProjectId = $state("");

  const project = $derived($snapshot);
  const hasNewer = $derived(page.offset > 0);
  const hasOlder = $derived(page.offset + page.runs.length < page.total);

  function historyPath(projectId: string, offset = 0) {
    const query = new URLSearchParams({
      offset: String(offset),
      limit: String(PAGE_SIZE),
    });
    return ingestionPath(projectId, `/runs?${query}`);
  }

  async function loadHistory(offset = 0) {
    if (!project || isWeb) return;
    loading = true;
    try {
      page = await ingestionJson<IngestionRunPage>(
        historyPath(project.project.id, offset),
      );
      status = "";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function openAudit(summary: IngestionRunSummary) {
    if (!project || detailLoading) return;
    detailLoading = true;
    try {
      selectedRun = await ingestionJson<IngestionRun>(
        ingestionPath(
          project.project.id,
          `/runs/${encodeURIComponent(summary.id)}`,
        ),
      );
      status = "";
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      detailLoading = false;
    }
  }

  function openInReview(summary: IngestionRunSummary) {
    router.push(
      `/records?${new URLSearchParams({
        sourceId: summary.sourceId.split(":")[0] ?? summary.sourceId,
        runId: summary.id,
      })}`,
    );
  }

  function formatDate(value: string) {
    const date = DateTime.fromISO(value, { zone: "utc" });
    return date.isValid ? date.toFormat("dd LLL yyyy, HH:mm 'UTC'") : value;
  }

  function proposalTitle(run: IngestionRun, index: number) {
    const proposal = run.proposals[index]!;
    const transaction = proposal.transaction;
    if (proposal.merchantResolution?.status === "confirmed") {
      return proposal.merchantResolution.merchant.canonicalName;
    }
    if (proposal.merchantResolution?.status === "suggested") {
      return (
        proposal.merchantResolution.candidates[0]?.canonicalName ??
        transaction?.merchant ??
        transaction?.payee ??
        transaction?.narration ??
        proposal.importId
      );
    }
    return (
      transaction?.merchant ??
      transaction?.payee ??
      transaction?.narration ??
      proposal.importId
    );
  }

  $effect(() => {
    const next = project;
    if (!next || isWeb || next.project.id === loadedProjectId) return;
    loadedProjectId = next.project.id;
    selectedRun = undefined;
    void loadHistory();
  });
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
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <Clock3 class="size-5 text-muted-foreground" />
            <h2 class="text-lg font-semibold">Import history</h2>
          </div>
          <p class="mt-1 text-sm text-muted-foreground">
            Archived runs are read-only. Open a pending run in Review imports to
            continue working on it.
          </p>
        </div>
        <span
          class="rounded-full bg-muted px-3 py-1 text-sm tabular-nums text-muted-foreground"
        >
          {page.total} run{page.total === 1 ? "" : "s"}
        </span>
      </header>

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
        <div class="flex flex-col gap-3">
          {#each page.runs as run (run.id)}
            <article class="rounded-xl border bg-card p-4 shadow-sm">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="font-medium">{run.sourceId}</h3>
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
                  <p class="mt-1 text-sm text-muted-foreground">
                    Completed {formatDate(run.completedAt)} · Run {run.id}
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  {#if run.reviewState === "pending"}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onclick={() => openInReview(run)}
                    >
                      <ExternalLink data-icon="inline-start" />
                      Open in Review
                    </Button>
                  {/if}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={detailLoading && selectedRun?.id !== run.id}
                    onclick={() => void openAudit(run)}
                  >
                    {selectedRun?.id === run.id
                      ? "Viewing audit"
                      : "View audit"}
                  </Button>
                </div>
              </div>
              <dl class="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt class="text-muted-foreground">Proposals</dt>
                  <dd class="font-medium tabular-nums">{run.summary.total}</dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Accepted</dt>
                  <dd class="font-medium tabular-nums">
                    {run.summary.accepted}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Need review</dt>
                  <dd class="font-medium tabular-nums">
                    {run.summary.needsReview}
                  </dd>
                </div>
                <div>
                  <dt class="text-muted-foreground">Duplicates</dt>
                  <dd class="font-medium tabular-nums">
                    {run.summary.duplicates}
                  </dd>
                </div>
              </dl>
            </article>
          {/each}
        </div>

        <div class="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!hasNewer || loading}
            onclick={() =>
              void loadHistory(Math.max(0, page.offset - page.limit))}
          >
            <ChevronLeft data-icon="inline-start" />
            Newer
          </Button>
          <span class="text-sm text-muted-foreground">
            {page.offset + 1}–{page.offset + page.runs.length} of {page.total}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!hasOlder || loading}
            onclick={() => void loadHistory(page.offset + page.limit)}
          >
            Older
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      {/if}

      {#if selectedRun}
        <section
          class="rounded-xl border bg-card p-4 shadow-sm"
          aria-live="polite"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="font-medium">Run audit</h3>
              <p class="mt-1 text-sm text-muted-foreground">
                {selectedRun.sourceId} · {formatDate(selectedRun.completedAt)}
              </p>
            </div>
            <span class="text-sm tabular-nums text-muted-foreground">
              {selectedRun.proposals.length} proposal{selectedRun.proposals
                .length === 1
                ? ""
                : "s"}
            </span>
          </div>

          {#if selectedRun.audit?.ai.length}
            <details class="mt-4 rounded-lg border bg-muted/30 p-3">
              <summary class="cursor-pointer text-sm font-medium">
                Initial AI audit ({selectedRun.audit.ai.length} call{selectedRun
                  .audit.ai.length === 1
                  ? ""
                  : "s"})
              </summary>
              <pre
                class="mt-3 max-h-80 overflow-auto rounded-md bg-background p-3 text-xs leading-relaxed">{JSON.stringify(
                  selectedRun.audit.ai,
                  null,
                  2,
                )}</pre>
            </details>
          {/if}

          <div class="mt-4 flex flex-col gap-3">
            {#each selectedRun.proposals as proposal, index (proposal.id)}
              <article class="rounded-lg border p-3">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="font-medium">
                      {proposalTitle(selectedRun, index)}
                    </p>
                    <p class="mt-1 text-sm text-muted-foreground">
                      {proposal.transaction
                        ? `${proposal.transaction.bookedAt} · ${proposal.transaction.amount} ${proposal.transaction.currency}`
                        : "No normalized transaction"}
                    </p>
                  </div>
                  <span
                    class="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                  >
                    {proposal.status}
                  </span>
                </div>
                {#if proposal.acceptance}
                  <p class="mt-2 text-sm text-muted-foreground">
                    Accepted into {proposal.acceptance.destinationPath} at {formatDate(
                      proposal.acceptance.acceptedAt,
                    )}
                  </p>
                {/if}
                <details class="mt-3">
                  <summary class="cursor-pointer text-sm text-muted-foreground">
                    Full proposal audit
                  </summary>
                  <pre
                    class="mt-3 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">{JSON.stringify(
                      proposal,
                      null,
                      2,
                    )}</pre>
                </details>
              </article>
            {/each}
          </div>
        </section>
      {/if}
    </div>
  {/if}
</div>
