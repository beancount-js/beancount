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

<section class="cn-pages-ingestionrunaudit-106-1" data-ingestion-run-audit>
  <div class="cn-pages-ingestionrunaudit-107-1">
    {#if isWeb}
      <div class="cn-pages-ingestionrunaudit-109-1">
        Import audit history is available when Studio has access to the project
        folder.
      </div>
    {:else if !hasProject}
      <div class="cn-pages-ingestionrunaudit-114-1">
        Open a project to view this import run.
      </div>
    {:else}
      <div class="cn-pages-ingestionrunaudit-118-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onclick={onBackToHistory}
        >
          <ArrowLeft data-icon="inline-start" />
          Import history
        </Button>
        {#if hasRun && runId}
          <span class="cn-pages-ingestionrunaudit-124-1">
            Run {runId}
          </span>
        {/if}
      </div>

      {#if status}
        <p class="cn-pages-ingestionrunaudit-132-1" role="status">
          {status}
        </p>
      {/if}

      {#if loading}
        <div class="cn-pages-ingestionrunaudit-140-1">
          Loading import audit...
        </div>
      {:else if hasRun}
        <section class="cn-pages-ingestionrunaudit-144-1">
          <div class="cn-pages-ingestionrunaudit-145-1">
            <div class="cn-pages-ingestionrunaudit-146-1">
              <p class="cn-pages-ingestionrunaudit-147-1">{sourceId}</p>
              <p class="cn-pages-ingestionrunaudit-148-1">
                Completed {completedAtLabel}
              </p>
            </div>
            <span class="cn-pages-ingestionrunaudit-152-1">
              {totalProposals} proposal{totalProposals === 1 ? "" : "s"}
            </span>
          </div>
          {#if summaryLine}
            <p class="cn-pages-ingestionrunaudit-157-1">{summaryLine}</p>
          {/if}
        </section>

        {#if aiCalls.length}
          <section class="cn-pages-ingestionrunaudit-162-1">
            <div class="cn-pages-ingestionrunaudit-163-1">
              <div>
                <h2 class="cn-pages-ingestionrunaudit-165-1">AI call audit</h2>
                <p class="cn-pages-ingestionrunaudit-166-1">
                  {aiCalls.length} call{aiCalls.length === 1 ? "" : "s"} captured
                  for this run.
                </p>
              </div>
            </div>
            <div class="cn-pages-ingestionrunaudit-171-1">
              <div class="cn-pages-ingestionrunaudit-172-1">
                {#each aiCalls as call (`${call.id}:${call.at}`)}
                  <details class="cn-pages-ingestionrunaudit-174-1">
                    <summary class="cn-pages-ingestionrunaudit-175-1">
                      <span class="cn-pages-ingestionrunaudit-176-1">
                        {#if call.ok}
                          <Check class="cn-pages-ingestionrunaudit-178-1" />
                        {:else}
                          <CircleX class="cn-pages-ingestionrunaudit-180-1" />
                        {/if}
                        {call.label}
                      </span>
                      <span class="cn-pages-ingestionrunaudit-184-1">
                        {call.at}
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
                    <div class="cn-pages-ingestionrunaudit-194-1">
                      {#if call.prompt}
                        <div>
                          <p class="cn-pages-ingestionrunaudit-197-1">Prompt</p>
                          <pre
                            class="cn-pages-ingestionrunaudit-200-1">{call.prompt}</pre>
                        </div>
                      {/if}
                      {#if call.response}
                        <div>
                          <p class="cn-pages-ingestionrunaudit-205-1">
                            Response
                          </p>
                          <pre
                            class="cn-pages-ingestionrunaudit-208-1">{call.response}</pre>
                        </div>
                      {/if}
                      {#if call.error}
                        <div>
                          <p class="cn-pages-ingestionrunaudit-213-1">Error</p>
                          <pre
                            class="cn-pages-ingestionrunaudit-216-1">{call.error}</pre>
                        </div>
                      {/if}
                    </div>
                  </details>
                {/each}
              </div>
            </div>
          </section>
        {/if}

        <div class="cn-pages-ingestionrunaudit-227-1">
          <div>
            <h2 class="cn-pages-ingestionrunaudit-229-1">Proposals</h2>
            <p class="cn-pages-ingestionrunaudit-230-1">
              Select a proposal to inspect its retained workflow and merchant
              context.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onclick={onToggleAllGroups}
          >
            {groupsCollapsedAll ? "Expand dates" : "Collapse dates"}
          </Button>
        </div>

        <div class="cn-pages-ingestionrunaudit-241-1">
          <span>Date</span>
          <span class="cn-pages-ingestionrunaudit-244-1">Amount</span>
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
            class="cn-pages-ingestionrunaudit-263-1"
            aria-labelledby={groupId}
          >
            <div class="cn-pages-ingestionrunaudit-267-1">
              <button
                type="button"
                class="cn-pages-ingestionrunaudit-271-1"
                aria-expanded={expanded}
                aria-controls={summaryId}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`}
                onclick={() => onToggleGroup(group.key)}
              >
                <span
                  id={groupId}
                  role="heading"
                  aria-level="2"
                  class="cn-pages-ingestionrunaudit-281-1"
                >
                  {group.label}
                  <span class="cn-pages-ingestionrunaudit-284-1"
                    >· {group.rows.length}</span
                  >
                </span>
              </button>
              <button
                type="button"
                class="cn-pages-ingestionrunaudit-289-1"
                aria-expanded={expanded}
                aria-controls={summaryId}
                aria-label={`${expanded ? "Collapse" : "Expand"} ${group.label}`}
                onclick={() => onToggleGroup(group.key)}
              >
                {#if expanded}
                  <ChevronUp class="cn-pages-ingestionrunaudit-296-1" />
                {:else}
                  <ChevronDown class="cn-pages-ingestionrunaudit-298-1" />
                {/if}
              </button>
            </div>

            {#if expanded}
              <div id={summaryId} class="cn-pages-ingestionrunaudit-306-1">
                {#each group.rows as row, index (row.key)}
                  <button
                    type="button"
                    class:cn-pages-ingestionrunaudit-311-1={index ===
                      group.rows.length - 1}
                    class="cn-pages-ingestionrunaudit-312-1"
                    aria-label={`Inspect ${row.title}`}
                    onclick={() => onOpenRow(row.key)}
                  >
                    {#if row.logoUrl && !failedLogoIds.has(row.proposalId)}
                      <img
                        class="cn-pages-ingestionrunaudit-318-1"
                        src={row.logoUrl}
                        alt=""
                        onerror={() => markLogoFailed(row.proposalId)}
                      />
                    {:else}
                      <div
                        class="cn-pages-ingestionrunaudit-325-1"
                        aria-hidden="true"
                      >
                        {row.initial}
                      </div>
                    {/if}
                    <div class="cn-pages-ingestionrunaudit-331-1">
                      <div class="cn-pages-ingestionrunaudit-332-1">
                        {row.title}
                      </div>
                      <div class="cn-pages-ingestionrunaudit-333-1">
                        {row.detail}
                      </div>
                    </div>
                    <span class="cn-pages-ingestionrunaudit-337-1"
                      >{row.amount}</span
                    >
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        {/each}

        {#if pageCount > 1}
          <div
            class="cn-pages-ingestionrunaudit-347-1"
            data-import-audit-pagination
          >
            <span class="cn-pages-ingestionrunaudit-350-1"
              >Page {page} of {pageCount}</span
            >
            <div class="cn-pages-ingestionrunaudit-351-1">
              <div class="cn-pages-ingestionrunaudit-352-1">
                <label
                  class="cn-pages-ingestionrunaudit-353-1"
                  for="ingestion-audit-page-size"
                >
                  Records per page
                </label>
                <select
                  id="ingestion-audit-page-size"
                  class="cn-pages-ingestionrunaudit-358-1"
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
                {onPageChange}
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
