<script lang="ts">
  import type { ImportProposal, IngestionRun } from "../ingestion/types";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    CollapsibleItemList,
    EntryActions,
    FilterCommandPicker,
    FormField,
    FormSectionHeader,
    TagEditor,
  } from "@beancount-js/forms";
  import { onDestroy } from "svelte";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import Check from "lucide-svelte/icons/check";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import CircleX from "lucide-svelte/icons/circle-x";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import Undo2 from "lucide-svelte/icons/undo-2";
  import CheckCheck from "lucide-svelte/icons/check-check";
  import X from "lucide-svelte/icons/x";
  import { useContext } from "../context";
  import LocalMerchantMatchPicker from "./LocalMerchantMatchPicker.svelte";

  type SectionKey = "workflow" | "merchant" | "transaction" | "metadata";

  type WorkflowStep = {
    key: string;
    label: string;
    ok: boolean;
    at?: string;
    prompt?: string;
    response?: string;
    error?: string;
  };

  const sectionTitleClass = "text-xs font-semibold uppercase tracking-wide";

  type MetadataRow = { key: string; value: string };
  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

  type ProposalDraft = {
    bookedAt: string;
    amount: string;
    currency: string;
    payee: string;
    narration: string;
    selectedAccount: string;
    tags: string[];
    links: string;
    metadata: MetadataRow[];
  };

  type Props = {
    open?: boolean;
    proposal: ImportProposal;
    runId: string;
    projectId: string;
    allowedAccounts?: readonly string[];
    aiEnabled?: boolean;
    readOnly?: boolean;
    onClosed?: () => void;
    onUpdated?: (run: IngestionRun) => void;
    onStatus?: (message: string) => void;
  };

  let {
    open = $bindable(false),
    proposal,
    runId,
    projectId,
    allowedAccounts = [],
    aiEnabled = false,
    readOnly = false,
    onClosed,
    onUpdated,
    onStatus,
  }: Props = $props();

  let wasOpen = $state(false);
  $effect(() => {
    if (wasOpen && !open) onClosed?.();
    wasOpen = open;
  });

  const { tags: ledgerTags } = useContext();

  let draft = $state<ProposalDraft>(emptyDraft());
  let loadedKey = $state("");
  let loadedIdentity = $state("");
  let correcting = $state(false);
  let correctionName = $state("");
  let correctionDomain = $state("");
  let correctionDescription = $state("");
  let attachedMerchantId = $state("");
  let failedLogo = $state(false);
  let saving = $state(false);
  let saveState = $state<SaveState>("idle");
  let saveTimer: number | null = null;
  let loadingDraft = $state(false);
  let enriching = $state(false);
  let busy = $state(false);
  let errors = $state<string[]>([]);
  let sheetTitleEl = $state<HTMLElement | null>(null);
  let sectionOpen = $state<Record<SectionKey, boolean>>({
    workflow: false,
    merchant: true,
    transaction: true,
    metadata: true,
  });
  let debugOpen = $state<Record<string, boolean>>({});
  let nestedForceCollapsed = $state(false);

  function isSectionOpen(key: SectionKey) {
    return sectionOpen[key] !== false;
  }

  function toggleSection(key: SectionKey) {
    sectionOpen = { ...sectionOpen, [key]: !isSectionOpen(key) };
  }

  function isDebugOpen(key: string, fallback: boolean) {
    if (nestedForceCollapsed) {
      return Object.hasOwn(debugOpen, key) ? debugOpen[key]! : false;
    }
    return Object.hasOwn(debugOpen, key) ? debugOpen[key]! : fallback;
  }

  function toggleDebug(key: string, fallback: boolean) {
    debugOpen = { ...debugOpen, [key]: !isDebugOpen(key, fallback) };
  }

  function prettyJson(value: unknown) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function isAiIssue(issue: string) {
    return (
      issue.startsWith("AI ") ||
      issue.startsWith("Merchant resolver ") ||
      issue.includes("merchant advisor") ||
      issue.includes("categoriser") ||
      issue.includes("categorizer")
    );
  }

  const aiIssues = $derived(proposal.issues.filter(isAiIssue));

  const workflowSteps = $derived.by((): WorkflowStep[] => {
    const steps: WorkflowStep[] = [];
    if (proposal.sourceRecord) {
      steps.push({
        key: "source-api",
        label: "Source API",
        ok: true,
        response: prettyJson(proposal.sourceRecord),
      });
    } else {
      steps.push({
        key: "source-api",
        label: "Source API",
        ok: true,
        response: "No source payload was stored for this proposal.",
      });
    }
    for (const call of proposal.lastAiEnrichment?.calls ?? []) {
      steps.push({
        key: `${call.id}:${call.at}`,
        label: call.label,
        ok: call.ok,
        at: call.at,
        prompt: call.prompt,
        response: call.response,
        error: call.error,
      });
    }
    return steps;
  });

  const workflowTimestamp = $derived(
    proposal.lastAiEnrichment?.at
      ? new Date(proposal.lastAiEnrichment.at).toLocaleString()
      : undefined,
  );

  function workflowStepDefaultOpen(step: WorkflowStep) {
    return step.key === "source-api" ? false : !step.ok;
  }

  const sectionsCollapsedAll = $derived(
    !isSectionOpen("workflow") ||
      !isSectionOpen("merchant") ||
      !isSectionOpen("transaction") ||
      !isSectionOpen("metadata"),
  );

  const saveHint = $derived(
    saveState === "dirty"
      ? "Unsaved changes…"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "saved"
          ? "Saved"
          : saveState === "error"
            ? "Save failed"
            : "",
  );

  function toggleCollapseAll() {
    if (sectionsCollapsedAll) {
      sectionOpen = {
        workflow: true,
        merchant: true,
        transaction: true,
        metadata: true,
      };
      nestedForceCollapsed = false;
      debugOpen = {};
      return;
    }
    sectionOpen = {
      workflow: false,
      merchant: false,
      transaction: false,
      metadata: false,
    };
    nestedForceCollapsed = true;
    debugOpen = {};
  }

  const accountItems = $derived(
    allowedAccounts.map((account) => ({ label: account, value: account })),
  );

  const merchantStatus = $derived(
    proposal.merchantResolution?.status ?? "unresolved",
  );

  const candidate = $derived(
    proposal.merchantResolution?.status === "suggested"
      ? proposal.merchantResolution.candidates[0]
      : undefined,
  );

  const merchant = $derived.by(() => {
    if (proposal.merchantResolution?.status === "confirmed") {
      return proposal.merchantResolution.merchant;
    }
    return candidate;
  });

  const title = $derived(
    merchant?.canonicalName ??
      proposal.transaction?.merchant ??
      proposal.transaction?.payee ??
      proposal.transaction?.narration ??
      "Proposal",
  );

  const editable = $derived(
    !readOnly &&
      Boolean(proposal.transaction) &&
      (proposal.status === "ready" || proposal.status === "needs-review"),
  );

  const canEnrichAi = $derived(
    !readOnly &&
      aiEnabled &&
      Boolean(proposal.transaction) &&
      (proposal.status === "ready" ||
        proposal.status === "needs-review" ||
        proposal.status === "held"),
  );

  const canUnaccept = $derived(
    editable &&
      proposal.status === "ready" &&
      Boolean(proposal.selectedAccount),
  );

  const canMarkAccepted = $derived(
    editable &&
      proposal.status === "needs-review" &&
      Boolean(draft.selectedAccount.trim()),
  );

  function emptyDraft(): ProposalDraft {
    return {
      bookedAt: "",
      amount: "",
      currency: "",
      payee: "",
      narration: "",
      selectedAccount: "",
      tags: [],
      links: "",
      metadata: [],
    };
  }

  function tokens(value: string) {
    return [
      ...new Set(
        value
          .split(/[\s,]+/)
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  function normalizeTags(values: string[]) {
    return [
      ...new Set(
        values.map((item) => item.trim().replace(/^#/, "")).filter(Boolean),
      ),
    ];
  }

  function detailsFor(next: ImportProposal) {
    if (next.merchantResolution?.status === "confirmed") {
      return next.merchantResolution.merchant;
    }
    if (next.merchantResolution?.status === "suggested") {
      return next.merchantResolution.candidates[0];
    }
    return undefined;
  }

  function loadDraft(next: ImportProposal) {
    loadingDraft = true;
    const tx = next.transaction;
    const details = detailsFor(next);
    draft = {
      bookedAt: tx?.bookedAt ?? "",
      amount: tx?.amount ?? "",
      currency: tx?.currency ?? "",
      payee: tx?.payee ?? "",
      narration: tx?.narration ?? "",
      selectedAccount: next.selectedAccount ?? "",
      tags: [...(tx?.tags ?? [])],
      links: (tx?.links ?? []).join(", "),
      metadata: Object.entries(tx?.metadata ?? {}).map(([key, value]) => ({
        key,
        value,
      })),
    };
    correcting = false;
    correctionName =
      details?.canonicalName ??
      tx?.merchant ??
      tx?.payee ??
      tx?.narration ??
      "";
    correctionDomain = details?.domain ?? "";
    correctionDescription = details?.description ?? "";
    attachedMerchantId = "";
    failedLogo = false;
    errors = [];
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveState = "idle";
    loadingDraft = false;
  }

  function scheduleSave() {
    if (!editable || loadingDraft) return;
    saveState = "dirty";
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      void saveNow();
    }, 1200);
  }

  $effect(() => {
    const identity = `${runId}:${proposal.id}`;
    const key = `${identity}:${proposal.status}:${proposal.selectedAccount ?? ""}:${proposal.transaction?.bookedAt ?? ""}:${proposal.transaction?.amount ?? ""}:${proposal.merchantResolution?.status ?? ""}`;
    if (identity !== loadedIdentity) {
      loadedIdentity = identity;
      debugOpen = {};
      nestedForceCollapsed = false;
      sectionOpen = {
        workflow: false,
        merchant: true,
        transaction: true,
        metadata: true,
      };
      loadedKey = key;
      loadDraft(proposal);
      return;
    }
    if (key === loadedKey) return;
    loadedKey = key;
    // Keep local edits if the user typed during an in-flight save.
    if (saveState === "dirty") return;
    loadDraft(proposal);
  });

  function merchantInitials() {
    const name =
      merchant?.canonicalName ??
      proposal.transaction?.merchant ??
      proposal.transaction?.narration ??
      "?";
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }

  function merchantProvenance() {
    const labels = (merchant?.provenance ?? []).map((item) =>
      item.provider ? `${item.source}:${item.provider}` : item.source,
    );
    return [...new Set(labels)].join(" · ");
  }

  function startCorrection() {
    correcting = true;
    correctionName =
      merchant?.canonicalName ??
      proposal.transaction?.merchant ??
      proposal.transaction?.narration ??
      "";
    correctionDomain = merchant?.domain ?? "";
    correctionDescription = merchant?.description ?? "";
  }

  function addMetadataRow() {
    draft.metadata = [...draft.metadata, { key: "", value: "" }];
    scheduleSave();
  }

  function removeMetadataRow(index: number) {
    draft.metadata = draft.metadata.filter((_, i) => i !== index);
    scheduleSave();
  }

  function moveMetadata(index: number, direction: -1 | 1) {
    if (!editable) return;
    const target = index + direction;
    if (target < 0 || target >= draft.metadata.length) return;
    const next = [...draft.metadata];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    draft.metadata = next;
    scheduleSave();
  }

  async function updateMerchant(
    action: "confirm" | "correct" | "reject" | "clear-suppression",
    extra: Record<string, string | undefined> = {},
  ) {
    busy = true;
    errors = [];
    try {
      const result = await ingestionJson<{ run: IngestionRun }>(
        ingestionPath(
          projectId,
          `/runs/${encodeURIComponent(runId)}/proposals/${encodeURIComponent(proposal.id)}/merchant`,
        ),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        },
      );
      correcting = false;
      onUpdated?.(result.run);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors = [message];
      onStatus?.(message);
    } finally {
      busy = false;
    }
  }

  async function rerunAiEnrichment() {
    if (!canEnrichAi) return;
    enriching = true;
    errors = [];
    try {
      const result = await ingestionJson<{ run: IngestionRun }>(
        ingestionPath(
          projectId,
          `/runs/${encodeURIComponent(runId)}/proposals/${encodeURIComponent(proposal.id)}/enrich`,
        ),
        { method: "POST" },
      );
      onUpdated?.(result.run);
      onStatus?.("AI enrichment updated this proposal.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors = [message];
      onStatus?.(message);
    } finally {
      enriching = false;
    }
  }

  async function setProposalStatus(status: "ready" | "needs-review") {
    if (!editable) return;
    busy = true;
    errors = [];
    try {
      const run = await ingestionJson<IngestionRun>(
        ingestionPath(projectId, `/runs/${encodeURIComponent(runId)}`),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            proposalId: proposal.id,
            status,
            ...(status === "ready" && draft.selectedAccount.trim()
              ? { account: draft.selectedAccount.trim() }
              : {}),
          }),
        },
      );
      onUpdated?.(run);
      onStatus?.(
        status === "needs-review"
          ? "Moved proposal back to pending review."
          : "Marked proposal as accepted.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors = [message];
      onStatus?.(message);
    } finally {
      busy = false;
    }
  }

  async function saveNow() {
    if (!editable) return;
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    saving = true;
    saveState = "saving";
    errors = [];
    try {
      const metadata: Record<string, string> = {};
      for (const row of draft.metadata) {
        const key = row.key.trim();
        if (!key) continue;
        metadata[key] = row.value;
      }
      const accountChanged =
        draft.selectedAccount.trim() !== (proposal.selectedAccount ?? "");
      const run = await ingestionJson<IngestionRun>(
        ingestionPath(projectId, `/runs/${encodeURIComponent(runId)}`),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            proposalId: proposal.id,
            ...(accountChanged && draft.selectedAccount.trim()
              ? { account: draft.selectedAccount.trim() }
              : {}),
            transaction: {
              bookedAt: draft.bookedAt,
              amount: draft.amount,
              currency: draft.currency,
              merchant: proposal.transaction?.merchant,
              payee: draft.payee,
              narration: draft.narration,
              tags: normalizeTags(draft.tags),
              links: tokens(draft.links),
              metadata,
            },
          }),
        },
      );
      onUpdated?.(run);
      saveState = "saved";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors = [message];
      onStatus?.(message);
      saveState = "error";
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    if (!open && saveState === "dirty") {
      void saveNow();
    }
  });

  onDestroy(() => {
    if (saveTimer) window.clearTimeout(saveTimer);
    if (saveState === "dirty") void saveNow();
  });
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="right"
    class="flex w-full flex-col gap-0 p-0 sm:max-w-2xl [&>button.absolute]:hidden"
    data-ingestion-proposal-sheet
    onOpenAutoFocus={(event) => {
      // Prefer the title over header icon buttons so tooltips don't flash open.
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header
      class="flex h-11 shrink-0 flex-row items-center gap-2 space-y-0 border-b border-border px-3 text-left sm:text-left"
    >
      <Sheet.Title
        bind:ref={sheetTitleEl}
        tabindex={-1}
        class="proposal-sheet-title min-w-0 flex-1 truncate leading-none outline-none"
      >
        {readOnly ? "Import proposal audit" : "Review Proposal"}
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        {readOnly
          ? "Read-only context retained for this import proposal."
          : "Review and edit this import proposal."}
      </Sheet.Description>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        {#if saveHint}
          <p class="text-xs text-muted-foreground" role="status">{saveHint}</p>
        {/if}
        {#if canUnaccept}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="size-8"
                  aria-label="Move to pending review"
                  disabled={busy || saving}
                  onclick={(event) => {
                    void setProposalStatus("needs-review");
                  }}
                >
                  <Undo2 class="size-4" aria-hidden="true" />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Move to pending review</Tooltip.Content>
          </Tooltip.Root>
        {:else if canMarkAccepted}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="size-8"
                  aria-label="Mark as accepted"
                  disabled={busy || saving}
                  onclick={(event) => {
                    void setProposalStatus("ready");
                  }}
                >
                  <CheckCheck class="size-4" aria-hidden="true" />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Mark as accepted</Tooltip.Content>
          </Tooltip.Root>
        {/if}
        {#if canEnrichAi || enriching}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  size="icon"
                  variant="ghost"
                  class="size-8"
                  aria-label="Re-run AI enrichment"
                  disabled={enriching || busy || saving || !canEnrichAi}
                  onclick={(event) => {
                    void rerunAiEnrichment();
                  }}
                >
                  <Sparkles
                    class={enriching ? "animate-pulse" : ""}
                    aria-hidden="true"
                  />
                </Button>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>
              {enriching ? "AI enrichment running…" : "Re-run AI enrichment"}
            </Tooltip.Content>
          </Tooltip.Root>
        {/if}
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon"
                class="size-8"
                aria-label={sectionsCollapsedAll
                  ? "Expand all"
                  : "Collapse all"}
                onclick={(event) => {
                  toggleCollapseAll();
                }}
              >
                {#if sectionsCollapsedAll}
                  <ChevronsUpDown class="size-4" aria-hidden="true" />
                {:else}
                  <ChevronsDownUp class="size-4" aria-hidden="true" />
                {/if}
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>
            {sectionsCollapsedAll ? "Expand all" : "Collapse all"}
          </Tooltip.Content>
        </Tooltip.Root>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Sheet.Close
                {...props}
                class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close"
              >
                <X class="size-4" />
                <span class="sr-only">Close</span>
              </Sheet.Close>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Sheet.Header>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      {#if errors.length}
        <Alert.Root variant="destructive" class="mb-5">
          <CircleAlert />
          <Alert.Title>Could not update proposal</Alert.Title>
          <Alert.Description class="whitespace-pre-wrap"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      <div class="proposal-form flex min-w-0 flex-col gap-6 pl-6">
        <section class="flex flex-col gap-2" aria-label="Workflow">
          <FormSectionHeader
            title="Workflow"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("workflow")}
            onToggle={() => toggleSection("workflow")}
          />
          {#if isSectionOpen("workflow")}
            <div class="proposal-section-body">
              {#if workflowTimestamp}
                <p class="text-xs text-muted-foreground">
                  Last run: {workflowTimestamp}
                </p>
              {/if}
              {#each workflowSteps as step (step.key)}
                {@const stepDefaultOpen = workflowStepDefaultOpen(step)}
                <section class="flex flex-col gap-2 pl-6">
                  <FormSectionHeader
                    title={step.label}
                    editable={false}
                    movable={false}
                    removable={false}
                    titleToggleable={true}
                    open={isDebugOpen(`call:${step.key}`, stepDefaultOpen)}
                    onToggle={() =>
                      toggleDebug(`call:${step.key}`, stepDefaultOpen)}
                  >
                    {#snippet actions()}
                      {#if step.ok}
                        <Check
                          class="size-4 text-green-600 dark:text-green-500"
                        />
                      {:else}
                        <CircleX class="size-4 text-destructive" />
                      {/if}
                    {/snippet}
                  </FormSectionHeader>
                  {#if isDebugOpen(`call:${step.key}`, stepDefaultOpen)}
                    <div class="flex flex-col gap-3 pl-2">
                      {#if step.error}
                        <section class="flex flex-col gap-2 pl-6">
                          <FormSectionHeader
                            title="Error"
                            editable={false}
                            movable={false}
                            removable={false}
                            titleToggleable={true}
                            open={isDebugOpen(`error:${step.key}`, true)}
                            onToggle={() =>
                              toggleDebug(`error:${step.key}`, true)}
                          >
                            {#snippet actions()}
                              <CircleX class="size-3.5 text-destructive" />
                            {/snippet}
                          </FormSectionHeader>
                          {#if isDebugOpen(`error:${step.key}`, true)}
                            <pre
                              class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-xs">{step.error}</pre>
                          {/if}
                        </section>
                      {/if}
                      {#if step.prompt}
                        <section class="flex flex-col gap-2 pl-6">
                          <FormSectionHeader
                            title="Prompt"
                            editable={false}
                            movable={false}
                            removable={false}
                            titleToggleable={true}
                            open={isDebugOpen(`prompt:${step.key}`, false)}
                            onToggle={() =>
                              toggleDebug(`prompt:${step.key}`, false)}
                          />
                          {#if isDebugOpen(`prompt:${step.key}`, false)}
                            <pre
                              class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-xs">{step.prompt}</pre>
                          {/if}
                        </section>
                      {/if}
                      {#if step.response}
                        <section class="flex flex-col gap-2 pl-6">
                          <FormSectionHeader
                            title="Response"
                            editable={false}
                            movable={false}
                            removable={false}
                            titleToggleable={true}
                            open={isDebugOpen(`response:${step.key}`, false)}
                            onToggle={() =>
                              toggleDebug(`response:${step.key}`, false)}
                          />
                          {#if isDebugOpen(`response:${step.key}`, false)}
                            <pre
                              class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-xs">{step.response}</pre>
                          {/if}
                        </section>
                      {/if}
                    </div>
                  {/if}
                </section>
              {/each}
              {#if aiIssues.length}
                <section class="flex flex-col gap-2 pl-6">
                  <FormSectionHeader
                    title="Issues"
                    editable={false}
                    movable={false}
                    removable={false}
                    titleToggleable={true}
                    open={isDebugOpen("issues", true)}
                    onToggle={() => toggleDebug("issues", true)}
                  >
                    {#snippet actions()}
                      <CircleX class="size-3.5 text-destructive" />
                    {/snippet}
                  </FormSectionHeader>
                  {#if isDebugOpen("issues", true)}
                    <div class="flex flex-col gap-2 pl-2">
                      {#each aiIssues as issue (issue)}
                        <pre
                          class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 text-xs">{issue}</pre>
                      {/each}
                    </div>
                  {/if}
                </section>
              {/if}
            </div>
          {/if}
        </section>

        <section class="flex flex-col gap-2">
          <FormSectionHeader
            title="Merchant"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("merchant")}
            onToggle={() => toggleSection("merchant")}
          />
          {#if isSectionOpen("merchant")}
            <div class="proposal-section-body">
              <div class="flex gap-3">
                {#if merchant?.logoUrl && !failedLogo}
                  <img
                    class="size-12 rounded-md border object-contain"
                    src={merchant.logoUrl}
                    alt={`${merchant.canonicalName} logo`}
                    onerror={() => (failedLogo = true)}
                  />
                {:else}
                  <div
                    class="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted text-sm font-medium text-muted-foreground"
                    aria-hidden="true"
                  >
                    {merchantInitials()}
                  </div>
                {/if}
                <div class="flex min-w-0 flex-1 flex-col gap-2">
                  <p class="truncate font-medium">{title}</p>
                  <p class="truncate text-xs text-muted-foreground">
                    Source: {proposal.transaction?.merchant ??
                      proposal.transaction?.narration ??
                      "—"}
                  </p>
                  {#if merchant?.domain || merchant?.industry}
                    <p class="truncate text-xs text-muted-foreground">
                      {[merchant?.domain, merchant?.industry]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  {/if}
                  {#if merchant?.description}
                    <p class="line-clamp-3 text-xs text-muted-foreground">
                      {merchant.description}
                    </p>
                  {/if}
                  {#if merchantProvenance()}
                    <p class="text-xs text-muted-foreground">
                      Provenance: {merchantProvenance()}
                    </p>
                  {/if}
                  <p class="text-xs text-muted-foreground">
                    {merchantStatus}
                    {#if proposal.merchantResolution?.explanation}
                      · {proposal.merchantResolution.explanation}
                    {/if}
                  </p>
                  {#if !readOnly && merchantStatus === "suggested" && candidate}
                    <div class="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onclick={() =>
                          updateMerchant("confirm", {
                            candidateId: candidate.id,
                            targetMerchantId: attachedMerchantId || undefined,
                          })}>Confirm</Button
                      >
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onclick={startCorrection}>Correct</Button
                      >
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onclick={() => updateMerchant("reject")}>Dismiss</Button
                      >
                    </div>
                  {:else if !readOnly && merchantStatus === "suppressed"}
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onclick={() => updateMerchant("clear-suppression")}
                        >Try again</Button
                      >
                    </div>
                  {:else if !readOnly}
                    <div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onclick={startCorrection}
                        >{merchantStatus === "confirmed"
                          ? "Edit"
                          : "Set merchant"}</Button
                      >
                    </div>
                  {/if}
                </div>
              </div>
              {#if !readOnly && (merchantStatus !== "suppressed" || correcting)}
                <div class="beancount-structured-form">
                  {#if merchantStatus !== "suppressed"}
                    <LocalMerchantMatchPicker
                      {projectId}
                      domain={correctionDomain}
                      searchText={`${correctionName} ${correctionDomain}`.trim()}
                      bind:attachedMerchantId
                      onAttach={(merchant) => {
                        correctionName = merchant.canonicalName;
                        if (merchant.domain) correctionDomain = merchant.domain;
                        if (merchant.description)
                          correctionDescription = merchant.description;
                      }}
                    />
                  {/if}
                  {#if correcting}
                    <FormField
                      label="Name"
                      align="center"
                      controlId="proposal-merchant-name"
                    >
                      <Input
                        id="proposal-merchant-name"
                        bind:value={correctionName}
                        placeholder="Merchant name"
                      />
                    </FormField>
                    <FormField
                      label="Domain"
                      align="center"
                      controlId="proposal-merchant-domain"
                    >
                      <Input
                        id="proposal-merchant-domain"
                        bind:value={correctionDomain}
                        placeholder="example.com"
                      />
                    </FormField>
                    <FormField
                      label="Description"
                      align="center"
                      controlId="proposal-merchant-description"
                    >
                      <Input
                        id="proposal-merchant-description"
                        bind:value={correctionDescription}
                        placeholder="Description"
                      />
                    </FormField>
                  {/if}
                </div>
              {/if}
              {#if correcting}
                <div class="flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    disabled={busy || !correctionName.trim()}
                    onclick={() =>
                      updateMerchant("correct", {
                        canonicalName: correctionName,
                        domain: correctionDomain || undefined,
                        description: correctionDescription || undefined,
                        targetMerchantId:
                          attachedMerchantId ||
                          (proposal.merchantResolution?.status === "confirmed"
                            ? proposal.merchantResolution.merchant.merchantId
                            : undefined),
                      })}>Save merchant</Button
                  >
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onclick={() => (correcting = false)}>Cancel</Button
                  >
                </div>
              {/if}
            </div>
          {/if}
        </section>

        <section class="flex flex-col gap-2">
          <FormSectionHeader
            title="Transaction"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("transaction")}
            onToggle={() => toggleSection("transaction")}
          />
          {#if isSectionOpen("transaction")}
            <form
              class="proposal-section-body"
              onsubmit={(event) => {
                event.preventDefault();
              }}
            >
              <div class="beancount-structured-form">
                <FormField
                  label="Date"
                  align="center"
                  controlId="ingestion-booked-at"
                >
                  <Input
                    id="ingestion-booked-at"
                    type="date"
                    bind:value={draft.bookedAt}
                    disabled={!editable && !readOnly}
                    readonly={readOnly}
                    oninput={() => scheduleSave()}
                  />
                </FormField>
                <FormField label="Amount" controlId="ingestion-amount">
                  <Input
                    id="ingestion-amount"
                    inputmode="decimal"
                    bind:value={draft.amount}
                    disabled={!editable && !readOnly}
                    readonly={readOnly}
                    oninput={() => scheduleSave()}
                  />
                </FormField>
                <FormField label="Currency" controlId="ingestion-currency">
                  <Input
                    id="ingestion-currency"
                    bind:value={draft.currency}
                    disabled={!editable && !readOnly}
                    readonly={readOnly}
                    oninput={() => scheduleSave()}
                  />
                </FormField>
                <FormField label="Payee" controlId="ingestion-payee">
                  <Input
                    id="ingestion-payee"
                    bind:value={draft.payee}
                    disabled={!editable && !readOnly}
                    readonly={readOnly}
                    oninput={() => scheduleSave()}
                  />
                </FormField>
                <FormField label="Narration" controlId="ingestion-narration">
                  <Input
                    id="ingestion-narration"
                    bind:value={draft.narration}
                    disabled={!editable && !readOnly}
                    readonly={readOnly}
                    oninput={() => scheduleSave()}
                  />
                </FormField>
                <FormField
                  label="Account"
                  as="div"
                  align="center"
                  controlId="ingestion-account"
                >
                  {#if editable}
                    <FilterCommandPicker
                      fullWidth
                      label="Account"
                      ariaLabel="Account"
                      placeholder="Filter accounts..."
                      value={draft.selectedAccount}
                      options={accountItems}
                      onChange={(value) => {
                        draft.selectedAccount = value;
                        scheduleSave();
                      }}
                    />
                  {:else}
                    <output id="ingestion-account"
                      >{draft.selectedAccount || " "}</output
                    >
                  {/if}
                </FormField>
                <FormField
                  label="Tags"
                  as="div"
                  align="center"
                  controlId="ingestion-tags"
                >
                  {#if readOnly}
                    <output id="ingestion-tags">{draft.tags.join(", ")}</output>
                  {:else}
                    <div
                      class={!editable
                        ? "pointer-events-none opacity-60"
                        : undefined}
                    >
                      <TagEditor
                        id="ingestion-tags"
                        value={draft.tags}
                        suggestions={$ledgerTags}
                        label="Tags"
                        showLabel={false}
                        embedded
                        uppercase={false}
                        placeholder="Add tag..."
                        onChange={(tags) => {
                          if (!editable) return;
                          draft.tags = normalizeTags(tags);
                          scheduleSave();
                        }}
                      />
                    </div>
                  {/if}
                </FormField>
                <FormField label="Links" controlId="ingestion-links">
                  <Input
                    id="ingestion-links"
                    placeholder="receipt-123"
                    bind:value={draft.links}
                    disabled={!editable && !readOnly}
                    readonly={readOnly}
                    oninput={() => scheduleSave()}
                  />
                </FormField>
              </div>
            </form>
          {/if}
        </section>

        {#if readOnly}
          <section class="flex flex-col gap-2" aria-label="Metadata">
            <FormSectionHeader
              title={`Metadata · ${draft.metadata.length}`}
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("metadata")}
              onToggle={() => toggleSection("metadata")}
            />
            {#if isSectionOpen("metadata")}
              <div class="proposal-section-body">
                {#each draft.metadata as row, index (index)}
                  <div class="beancount-structured-form">
                    <FormField label="Key" controlId={`meta-${index}-key`}>
                      <output id={`meta-${index}-key`}>{row.key}</output>
                    </FormField>
                    <FormField label="Value" controlId={`meta-${index}-value`}>
                      <output id={`meta-${index}-value`}>{row.value}</output>
                    </FormField>
                  </div>
                {/each}
              </div>
            {/if}
          </section>
        {:else}
          <CollapsibleItemList
            title="Metadata"
            addLabel="field"
            count={draft.metadata.length}
            open={isSectionOpen("metadata")}
            onToggle={() => toggleSection("metadata")}
            onAdd={() => {
              if (editable) addMetadataRow();
            }}
          >
            {#each draft.metadata as row, index (index)}
              <EntryActions
                {index}
                total={draft.metadata.length}
                removeLabel={`Remove metadata ${index + 1}`}
                onMove={(direction) => moveMetadata(index, direction)}
                onRemove={() => {
                  if (editable) removeMetadataRow(index);
                }}
              >
                <div class="beancount-structured-form">
                  <FormField label="Key" controlId={`meta-${index}-key`}>
                    <Input
                      id={`meta-${index}-key`}
                      bind:value={row.key}
                      disabled={!editable}
                      placeholder="Add key"
                      oninput={() => scheduleSave()}
                    />
                  </FormField>
                  <FormField label="Value" controlId={`meta-${index}-value`}>
                    <Input
                      id={`meta-${index}-value`}
                      bind:value={row.value}
                      disabled={!editable}
                      placeholder="Add value"
                      oninput={() => scheduleSave()}
                    />
                  </FormField>
                </div>
              </EntryActions>
            {/each}
          </CollapsibleItemList>
        {/if}
      </div>
    </div>
  </Sheet.Content>
</Sheet.Root>

<style>
  .proposal-form :global(.beancount-structured-form) {
    min-width: 0;
  }

  .proposal-section-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-left: 0.5rem;
    min-width: 0;
  }

  :global(.proposal-sheet-title),
  .proposal-form :global(.beancount-form-item-list-toggle),
  .proposal-form :global(.beancount-form-section-title-toggle),
  .proposal-form :global(.beancount-form-section-title-row h3) {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
