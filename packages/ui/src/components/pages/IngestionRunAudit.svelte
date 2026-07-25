<script module lang="ts">
  export type IngestionRunAuditAiCall = {
    id: string;
    at: string;
    label: string;
    ok: boolean;
    batchSize?: number;
    durationMs?: number;
    prompt?: string;
    response?: string;
    error?: string;
  };

  export type IngestionRunAuditRow = {
    key: string;
    proposalId: string;
    title: string;
    detail: string;
    amount: string;
    initial: string;
    logoUrl?: string;
  };

  export type IngestionRunAuditDateGroup = {
    key: string;
    label: string;
    rows: IngestionRunAuditRow[];
  };

  export type IngestionRunAuditProps = {
    isWeb?: boolean;
    hasProject?: boolean;
    loading?: boolean;
    status?: string;
    hasRun?: boolean;
    runId?: string;
    sourceId?: string;
    completedAtLabel?: string;
    totalProposals?: number;
    summaryLine?: string;
    aiCalls?: readonly IngestionRunAuditAiCall[];
    dateGroups?: readonly IngestionRunAuditDateGroup[];
    visibleGroups?: readonly IngestionRunAuditDateGroup[];
    expandedGroupKeys?: ReadonlySet<string>;
    groupsCollapsedAll?: boolean;
    page?: number;
    pageCount?: number;
    pageSize?: number;
    pageSizeOptions?: readonly number[];
    onBackToHistory?: () => void;
    onToggleAllGroups?: () => void;
    onToggleGroup?: (groupKey: string) => void;
    onOpenRow?: (rowKey: string) => void;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };

  const DEFAULT_PAGE_SIZES = [25, 50, 100];
</script>

<script lang="ts">
  import ArrowLeft from "lucide-svelte/icons/arrow-left";
  import Check from "lucide-svelte/icons/check";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronUp from "lucide-svelte/icons/chevron-up";
  import CircleX from "lucide-svelte/icons/circle-x";
  import { Button } from "../shadcn/button";
  import * as Empty from "../shadcn/empty";
  import PagePagination from "../navigation/PagePagination.svelte";

  let {
    isWeb = false,
    hasProject = false,
    loading = false,
    status = "",
    hasRun = false,
    runId = "",
    sourceId = "",
    completedAtLabel = "",
    totalProposals = 0,
    summaryLine = "",
    aiCalls = [],
    dateGroups = [],
    visibleGroups = [],
    expandedGroupKeys = new Set<string>(),
    groupsCollapsedAll = true,
    page = 1,
    pageCount = 1,
    pageSize = 50,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    onBackToHistory = () => {},
    onToggleAllGroups = () => {},
    onToggleGroup = () => {},
    onOpenRow = () => {},
    onPageChange = () => {},
    onPageSizeChange = () => {},
  }: IngestionRunAuditProps = $props();

  let failedLogoIds = $state(new Set<string>());

  function markLogoFailed(proposalId: string) {
    failedLogoIds = new Set([...failedLogoIds, proposalId]);
  }
</script>

<section class="h-full overflow-auto p-3 sm:p-5" data-ingestion-run-audit>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-5">
    {#if isWeb}
      <div class="rounded-md border p-4 text-sm text-muted-foreground">
        Import audit history is available when Studio has access to the project
        folder.
      </div>
    {:else if !hasProject}
      <div class="rounded-md border p-4 text-sm text-muted-foreground">
        Open a project to view this import run.
      </div>
    {:else}
      <div class="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onclick={onBackToHistory}>
          <ArrowLeft data-icon="inline-start" />
          Import history
        </Button>
        {#if hasRun && runId}
          <span class="text-xs tabular-nums text-muted-foreground">
            Run {runId}
          </span>
        {/if}
      </div>

      {#if status}
        <p
          class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="status"
        >
          {status}
        </p>
      {/if}

      {#if loading}
        <div class="rounded-xl border p-6 text-sm text-muted-foreground">
          Loading import audit...
        </div>
      {:else if hasRun}
        <section class="rounded-2xl border bg-card px-5 py-4 shadow-sm">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="truncate text-base font-semibold">{sourceId}</p>
              <p class="mt-1 text-sm text-muted-foreground">
                Completed {completedAtLabel}
              </p>
            </div>
            <span class="text-sm tabular-nums text-muted-foreground">
              {totalProposals} proposal{totalProposals === 1 ? "" : "s"}
            </span>
          </div>
          {#if summaryLine}
            <p class="mt-3 text-sm text-muted-foreground">{summaryLine}</p>
          {/if}
        </section>

        {#if aiCalls.length}
          <section class="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div class="flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 class="text-sm font-semibold">AI call audit</h2>
                <p class="mt-1 text-xs text-muted-foreground">
                  {aiCalls.length} call{aiCalls.length === 1 ? "" : "s"} captured for this run.
                </p>
              </div>
            </div>
            <div class="border-t px-5 py-4">
              <div class="flex flex-col gap-3">
                {#each aiCalls as call (`${call.id}:${call.at}`)}
                  <details class="rounded-xl border bg-muted/30 px-4 py-3">
                    <summary class="cursor-pointer text-sm font-medium">
                      <span class="inline-flex items-center gap-2">
                        {#if call.ok}
                          <Check class="size-4 text-green-600 dark:text-green-500" />
                        {:else}
                          <CircleX class="size-4 text-destructive" />
                        {/if}
                        {call.label}
                      </span>
                      <span class="ml-2 text-xs font-normal text-muted-foreground">
                        {call.at}
                        {#if call.batchSize}
                          · {call.batchSize} item{call.batchSize === 1 ? "" : "s"}
                        {/if}
                        {#if call.durationMs !== undefined}
                          · {(call.durationMs / 1000).toFixed(1)}s
                        {/if}
                      </span>
                    </summary>
                    <div class="mt-3 flex flex-col gap-3">
                      {#if call.prompt}
                        <div>
                          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Prompt
                          </p>
                          <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-background p-3 text-xs">{call.prompt}</pre>
                        </div>
                      {/if}
                      {#if call.response}
                        <div>
                          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Response
                          </p>
                          <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-background p-3 text-xs">{call.response}</pre>
                        </div>
                      {/if}
                      {#if call.error}
                        <div>
                          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-destructive">
                            Error
                          </p>
                          <pre class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{call.error}</pre>
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
          <Button type="button" size="sm" variant="ghost" onclick={onToggleAllGroups}>
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
          {@const expanded = expandedGroupKeys.has(group.key)}
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
                onclick={() => onToggleGroup(group.key)}
              >
                <span
                  id={groupId}
                  role="heading"
                  aria-level="2"
                  class="truncate text-sm font-semibold tracking-wide text-foreground"
                >
                  {group.label}
                  <span class="ml-2 text-muted-foreground">· {group.rows.length}</span>
                </span>
              </button>
              <button
                type="button"
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-expanded={expanded}
                aria-controls={summaryId}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`}
                onclick={() => onToggleGroup(group.key)}
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
                  <button
                    type="button"
                    class:rounded-b-xl={index === group.rows.length - 1}
                    class="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-[15px] py-4 text-left outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Inspect ${row.title}`}
                    onclick={() => onOpenRow(row.key)}
                  >
                    {#if row.logoUrl && !failedLogoIds.has(row.proposalId)}
                      <img
                        class="size-10 rounded-full border object-contain"
                        src={row.logoUrl}
                        alt=""
                        onerror={() => markLogoFailed(row.proposalId)}
                      />
                    {:else}
                      <div
                        class="flex size-10 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground"
                        aria-hidden="true"
                      >
                        {row.initial}
                      </div>
                    {/if}
                    <div class="min-w-0">
                      <div class="truncate text-sm font-semibold">{row.title}</div>
                      <div class="mt-1 truncate text-xs text-muted-foreground">
                        {row.detail}
                      </div>
                    </div>
                    <span class="text-sm font-semibold tabular-nums">{row.amount}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        {/each}

        {#if pageCount > 1}
          <div
            class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-import-audit-pagination
          >
            <span class="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
            <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <div class="hidden items-center gap-2 sm:flex">
                <label class="text-sm text-muted-foreground" for="ingestion-audit-page-size">
                  Records per page
                </label>
                <select
                  id="ingestion-audit-page-size"
                  class="h-8 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onchange={(event) =>
                    onPageSizeChange(
                      Number((event.currentTarget as HTMLSelectElement).value),
                    )}
                >
                  {#each pageSizeOptions as size (size)}
                    <option value={size}>{size}</option>
                  {/each}
                </select>
              </div>
              <PagePagination
                {page}
                {pageCount}
                ariaLabel="Import audit pages"
                onPageChange={onPageChange}
              />
            </div>
          </div>
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
</section>
