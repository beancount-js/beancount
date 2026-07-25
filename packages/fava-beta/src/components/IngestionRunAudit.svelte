<script lang="ts">
  import { onDestroy } from "svelte";
  import { DateTime } from "luxon";
  import SharedIngestionRunAudit, {
    type IngestionRunAuditAiCall,
    type IngestionRunAuditDateGroup,
    type IngestionRunAuditRow,
  } from "@lapis/ui/pages/IngestionRunAudit.svelte";
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
  const uiAiCalls = $derived<IngestionRunAuditAiCall[]>(
    (run?.audit?.ai ?? []).map((call) => ({
      id: call.id,
      at: formatDateTime(call.at),
      label: call.label,
      ok: call.ok,
      batchSize: call.batchSize,
      durationMs: call.durationMs,
      prompt: call.prompt,
      response: call.response,
      error: call.error,
    })),
  );
  const uiDateGroups = $derived<IngestionRunAuditDateGroup[]>(
    dateGroups.map((group) => ({
      key: group.key,
      label: group.label,
      rows: group.rows.map(uiRow),
    })),
  );
  const uiVisibleGroups = $derived<IngestionRunAuditDateGroup[]>(
    visibleGroups.map((group) => ({
      key: group.key,
      label: group.label,
      rows: group.rows.map(uiRow),
    })),
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
        "-"
      );
    }
    return (
      proposal.transaction?.merchant ??
      proposal.transaction?.payee ??
      proposal.transaction?.narration ??
      "-"
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
    return transaction ? `${transaction.amount} ${transaction.currency}` : "-";
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

  function uiRow(row: ProposalRow): IngestionRunAuditRow {
    return {
      key: row.key,
      proposalId: row.proposal.id,
      title: rowTitle(row.proposal),
      detail: rowDetail(row.proposal),
      amount: rowAmount(row.proposal),
      initial: rowInitial(row.proposal),
      logoUrl: merchantLogo(row.proposal),
    };
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

  function openRowKey(rowKey: string) {
    const row = rows.find((item) => item.key === rowKey);
    if (row) updateRoute({ proposalId: row.proposal.id });
  }

  function closeProposalSheet() {
    if (queryProposalId) updateRoute({ proposalId: undefined });
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

<SharedIngestionRunAudit
  {isWeb}
  hasProject={Boolean(project)}
  {loading}
  {status}
  hasRun={Boolean(run)}
  runId={run?.id ?? runId}
  sourceId={run?.sourceId ?? ""}
  completedAtLabel={run ? formatDateTime(run.completedAt) : ""}
  totalProposals={run?.summary.total ?? 0}
  {summaryLine}
  aiCalls={uiAiCalls}
  dateGroups={uiDateGroups}
  visibleGroups={uiVisibleGroups}
  expandedGroupKeys={expandedGroups}
  {groupsCollapsedAll}
  {page}
  pageCount={pages.length}
  {pageSize}
  pageSizeOptions={PAGE_SIZES}
  onBackToHistory={() => router.push("/import/history")}
  onToggleAllGroups={toggleAllGroups}
  onToggleGroup={toggleSummary}
  onOpenRow={openRowKey}
  onPageChange={(nextPage) => updateRoute({ page: String(nextPage) })}
  onPageSizeChange={(nextSize) =>
    updateRoute({ pageSize: String(nextSize), page: "1" })}
/>

{#if selectedRow && project && run}
  {#key selectedRow.key}
    <IngestionProposalSheet
      bind:open={sheetOpen}
      proposal={selectedRow.proposal}
      runId={run.id}
      projectId={project.project.id}
      auditCalls={run.audit?.ai}
      readOnly
      onClosed={closeProposalSheet}
    />
  {/key}
{/if}
