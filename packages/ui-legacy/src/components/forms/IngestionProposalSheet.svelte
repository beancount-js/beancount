<script lang="ts">
  import {
    normalizeMerchant,
    scopeAiEnrichmentCall,
  } from "@beancount-js/beangulp";
  import type {
    AiEnrichmentCallRecord,
    ImportProposal,
    IngestionRun,
  } from "../ingestion/types";
  import CollapsibleItemList from "./CollapsibleItemList.svelte";
  import EntryActions from "./EntryActions.svelte";
  import FilterCommandPicker from "./FilterCommandPicker.svelte";
  import FormField from "./FormField.svelte";
  import FormSectionHeader from "./FormSectionHeader.svelte";
  import TagEditor from "./TagEditor.svelte";
  import LocalMerchantMatchPicker from "./LocalMerchantMatchPicker.svelte";
  import type {
    FilterCommandOption,
    FilterCommandSearchAction,
  } from "./picker-options";
  import type { MerchantPickerMerchant } from "./MerchantPicker.svelte";
  import { onDestroy } from "svelte";
  import * as Alert from "../shadcn/alert";
  import { Button } from "../shadcn/button";
  import { Input } from "../shadcn/input";
  import * as Sheet from "../shadcn/sheet";
  import * as Tooltip from "../shadcn/tooltip";
  import Check from "lucide-svelte/icons/check";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import CircleX from "lucide-svelte/icons/circle-x";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import Undo2 from "lucide-svelte/icons/undo-2";
  import CheckCheck from "lucide-svelte/icons/check-check";
  import X from "lucide-svelte/icons/x";

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

  const sectionTitleClass = "cn-form-section-title";

  type MetadataRow = { key: string; value: string };
  type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
  type ProposalStatus = "ready" | "needs-review";
  type ProposalUpdatePayload = {
    action: "confirm" | "correct" | "reject" | "clear-suppression";
    candidateId?: string;
    canonicalName?: string;
    domain?: string;
    description?: string;
    targetMerchantId?: string;
  };

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
    /** Full run audit retained for compatibility with older batched snapshots. */
    auditCalls?: readonly AiEnrichmentCallRecord[];
    aiEnabled?: boolean;
    readOnly?: boolean;
    tags?: readonly string[];
    localMerchants?: readonly MerchantPickerMerchant[];
    localMerchantMessages?: readonly string[];
    localMerchantSearchAction?: (
      search: string,
    ) => FilterCommandSearchAction | null | undefined;
    localMerchantSearchActionLabel?: string;
    onLocalMerchantSearchAction?: (search: string) => Promise<void> | void;
    onClosed?: () => void;
    onUpdateMerchant?: (
      request: ProposalUpdatePayload & { normalizedLabels: readonly string[] },
    ) => Promise<IngestionRun> | IngestionRun | void;
    onDetectMerchant?: (
      normalizedLabels: readonly string[],
    ) => Promise<IngestionRun> | IngestionRun | void;
    onSetProposalStatus?: (
      status: ProposalStatus,
      account?: string,
    ) => Promise<IngestionRun> | IngestionRun | void;
    onSaveProposal?: (
      proposalId: string,
      account: string | undefined,
      transaction: {
        bookedAt: string;
        amount: string;
        currency: string;
        merchant: string | undefined;
        payee: string;
        narration: string;
        tags: string[];
        links: string[];
        metadata: Record<string, string>;
      },
    ) => Promise<IngestionRun> | IngestionRun | void;
    onUpdated?: (run: IngestionRun) => void;
    onStatus?: (message: string) => void;
  };

  let {
    open = $bindable(false),
    proposal,
    runId,
    projectId: _projectId,
    allowedAccounts = [],
    auditCalls = [],
    aiEnabled = false,
    readOnly = false,
    tags = [],
    localMerchants = [],
    localMerchantMessages = [],
    localMerchantSearchAction,
    localMerchantSearchActionLabel = "Brand Match",
    onLocalMerchantSearchAction,
    onClosed,
    onUpdateMerchant,
    onDetectMerchant,
    onSetProposalStatus,
    onSaveProposal,
    onUpdated,
    onStatus,
  }: Props = $props();

  void _projectId;

  let wasOpen = $state(false);
  $effect(() => {
    if (wasOpen && !open) onClosed?.();
    wasOpen = open;
  });

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
  const localMerchantEmptyOption = $state<FilterCommandOption>({
    value: "",
    label: "Create new merchant",
    description: "Save the merchant details from this transaction.",
  });

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

  function transactionMerchantLabel(proposal: ImportProposal) {
    return (
      proposal.merchantResolution?.rawLabel ??
      proposal.transaction?.merchant ??
      proposal.transaction?.payee ??
      proposal.transaction?.narration
    );
  }

  function merchantAdvisorBatchItemId(sourceId: string, rawLabel: string) {
    return `merchant:${sourceId}\u0000${normalizeMerchant(rawLabel)}`;
  }

  function matchingAiItemIds(call: AiEnrichmentCallRecord) {
    const itemIds = new Set(call.itemIds ?? []);
    const matches = [`category:${proposal.id}`].filter((id) => itemIds.has(id));
    const merchantLabel = transactionMerchantLabel(proposal);
    if (merchantLabel && proposal.transaction) {
      const merchantId = merchantAdvisorBatchItemId(
        proposal.transaction.sourceId,
        merchantLabel,
      );
      if (itemIds.has(merchantId)) matches.push(merchantId);
    }
    return matches;
  }

  function callKey(call: AiEnrichmentCallRecord) {
    return call.callId ?? `${call.id}:${call.at}`;
  }

  function workflowCall(call: AiEnrichmentCallRecord) {
    if (call.prompt || call.response || !call.batchSize || call.batchSize <= 1)
      return call;
    const auditCall = auditCalls.find(
      (candidate) => callKey(candidate) === callKey(call),
    );
    if (!auditCall) return call;
    const itemIds = matchingAiItemIds(call);
    return itemIds.length
      ? scopeAiEnrichmentCall(auditCall, itemIds)
      : { ...call, prompt: auditCall.prompt, response: auditCall.response };
  }

  const aiIssues = $derived(proposal.issues.filter(isAiIssue));

  const workflowCalls = $derived.by(() =>
    (proposal.lastAiEnrichment?.calls ?? []).map(workflowCall),
  );

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
    for (const call of workflowCalls) {
      steps.push({
        key: `${call.id}:${call.at}`,
        label:
          call.batchSize && call.batchSize > 1
            ? `${call.label} · batch of ${call.batchSize}`
            : call.label,
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
    if (readOnly) return;
    if (!onUpdateMerchant) {
      errors = ["No update handler is configured."];
      return;
    }
    busy = true;
    errors = [];
    try {
      const run = await onUpdateMerchant({
        action,
        normalizedLabels,
        ...extra,
      });
      correcting = false;
      if (run) onUpdated?.(run);
      onStatus?.(
        action === "confirm" || action === "correct"
          ? "Merchant confirmed across pending imports."
          : action === "reject"
            ? "Merchant dismissed for matching labels."
            : "Merchant enrichment cleared.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors = [message];
      onStatus?.(message);
    } finally {
      busy = false;
    }
  }

  async function rerunAiEnrichment() {
    if (readOnly) return;
    if (!canEnrichAi) return;
    if (!onDetectMerchant) {
      errors = ["No AI enrichment handler is configured."];
      return;
    }
    enriching = true;
    errors = [];
    try {
      const run = await onDetectMerchant(normalizedLabels);
      if (run) onUpdated?.(run);
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
    if (!onSetProposalStatus) {
      errors = ["No status update handler is configured."];
      return;
    }
    busy = true;
    errors = [];
    try {
      const run = await onSetProposalStatus(
        status,
        status === "ready" && draft.selectedAccount.trim()
          ? draft.selectedAccount.trim()
          : undefined,
      );
      if (run) onUpdated?.(run);
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
    if (!onSaveProposal) {
      errors = ["No proposal save handler is configured."];
      return;
    }
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
      const run = await onSaveProposal(
        proposal.id,
        accountChanged ? draft.selectedAccount.trim() : undefined,
        {
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
      );
      if (run) onUpdated?.(run);
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
    class="cn-forms-ingestionproposalsheet-731-1"
    data-ingestion-proposal-sheet
    onOpenAutoFocus={(event) => {
      // Prefer the title over header icon buttons so tooltips don't flash open.
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header class="cn-forms-ingestionproposalsheet-740-1">
      <Sheet.Title
        bind:ref={sheetTitleEl}
        tabindex={-1}
        class="cn-forms-ingestionproposalsheet-745-1 proposal-sheet-title"
      >
        {readOnly ? "Import proposal audit" : "Review Proposal"}
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        {readOnly
          ? "Read-only context retained for this import proposal."
          : "Review and edit this import proposal."}
      </Sheet.Description>
      <div class="cn-forms-ingestionproposalsheet-754-1">
        {#if saveHint}
          <p class="cn-forms-ingestionproposalsheet-756-1" role="status">
            {saveHint}
          </p>
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
                  class="cn-forms-ingestionproposalsheet-767-1"
                  aria-label="Move to pending review"
                  disabled={busy || saving}
                  onclick={(event) => {
                    void setProposalStatus("needs-review");
                  }}
                >
                  <Undo2
                    class="cn-forms-ingestionproposalsheet-774-1"
                    aria-hidden="true"
                  />
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
                  class="cn-forms-ingestionproposalsheet-789-1"
                  aria-label="Mark as accepted"
                  disabled={busy || saving}
                  onclick={(event) => {
                    void setProposalStatus("ready");
                  }}
                >
                  <CheckCheck
                    class="cn-forms-ingestionproposalsheet-796-1"
                    aria-hidden="true"
                  />
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
                  class="cn-forms-ingestionproposalsheet-812-1"
                  aria-label="Re-run AI enrichment"
                  disabled={enriching || busy || saving || !canEnrichAi}
                  onclick={(event) => {
                    void rerunAiEnrichment();
                  }}
                >
                  <Sparkles
                    class={enriching
                      ? "cn-forms-ingestionproposalsheet-820-1"
                      : ""}
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
                class="cn-forms-ingestionproposalsheet-839-1"
                aria-label={sectionsCollapsedAll
                  ? "Expand all"
                  : "Collapse all"}
                onclick={(event) => {
                  toggleCollapseAll();
                }}
              >
                {#if sectionsCollapsedAll}
                  <ChevronsUpDown
                    class="cn-forms-ingestionproposalsheet-848-1"
                    aria-hidden="true"
                  />
                {:else}
                  <ChevronsDownUp
                    class="cn-forms-ingestionproposalsheet-850-1"
                    aria-hidden="true"
                  />
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
                class="cn-forms-ingestionproposalsheet-864-1"
                aria-label="Close"
              >
                <X class="cn-forms-ingestionproposalsheet-867-1" />
                <span class="sr-only">Close</span>
              </Sheet.Close>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Sheet.Header>

    <div class="cn-forms-ingestionproposalsheet-877-1">
      {#if errors.length}
        <Alert.Root
          variant="destructive"
          class="cn-forms-ingestionproposalsheet-879-1"
        >
          <CircleAlert />
          <Alert.Title>Could not update proposal</Alert.Title>
          <Alert.Description class="cn-forms-ingestionproposalsheet-882-1"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      <div class="cn-forms-ingestionproposalsheet-888-1 proposal-form">
        <section
          class="cn-forms-ingestionproposalsheet-889-1"
          aria-label="Workflow"
        >
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
                <p class="cn-forms-ingestionproposalsheet-903-1">
                  Last run: {workflowTimestamp}
                </p>
              {/if}
              {#each workflowSteps as step (step.key)}
                {@const stepDefaultOpen = workflowStepDefaultOpen(step)}
                <section class="cn-forms-ingestionproposalsheet-909-1">
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
                        <Check class="cn-forms-ingestionproposalsheet-923-1" />
                      {:else}
                        <CircleX
                          class="cn-forms-ingestionproposalsheet-926-1"
                        />
                      {/if}
                    {/snippet}
                  </FormSectionHeader>
                  {#if isDebugOpen(`call:${step.key}`, stepDefaultOpen)}
                    <div class="cn-forms-ingestionproposalsheet-931-1">
                      {#if step.error}
                        <section class="cn-forms-ingestionproposalsheet-933-1">
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
                              <CircleX
                                class="cn-forms-ingestionproposalsheet-945-1"
                              />
                            {/snippet}
                          </FormSectionHeader>
                          {#if isDebugOpen(`error:${step.key}`, true)}
                            <pre
                              class="cn-forms-ingestionproposalsheet-950-1">{step.error}</pre>
                          {/if}
                        </section>
                      {/if}
                      {#if step.prompt}
                        <section class="cn-forms-ingestionproposalsheet-955-1">
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
                              class="cn-forms-ingestionproposalsheet-968-1">{step.prompt}</pre>
                          {/if}
                        </section>
                      {/if}
                      {#if step.response}
                        <section class="cn-forms-ingestionproposalsheet-973-1">
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
                              class="cn-forms-ingestionproposalsheet-986-1">{step.response}</pre>
                          {/if}
                        </section>
                      {/if}
                    </div>
                  {/if}
                </section>
              {/each}
              {#if aiIssues.length}
                <section class="cn-forms-ingestionproposalsheet-995-1">
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
                      <CircleX class="cn-forms-ingestionproposalsheet-1006-1" />
                    {/snippet}
                  </FormSectionHeader>
                  {#if isDebugOpen("issues", true)}
                    <div class="cn-forms-ingestionproposalsheet-1010-1">
                      {#each aiIssues as issue (issue)}
                        <pre
                          class="cn-forms-ingestionproposalsheet-1013-1">{issue}</pre>
                      {/each}
                    </div>
                  {/if}
                </section>
              {/if}
            </div>
          {/if}
        </section>

        <section class="cn-forms-ingestionproposalsheet-1023-1">
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
              <div class="cn-forms-ingestionproposalsheet-1036-1">
                {#if merchant?.logoUrl && !failedLogo}
                  <img
                    class="cn-forms-ingestionproposalsheet-1039-1"
                    src={merchant.logoUrl}
                    alt={`${merchant.canonicalName} logo`}
                    onerror={() => (failedLogo = true)}
                  />
                {:else}
                  <div
                    class="cn-forms-ingestionproposalsheet-1046-1"
                    aria-hidden="true"
                  >
                    {merchantInitials()}
                  </div>
                {/if}
                <div class="cn-forms-ingestionproposalsheet-1052-1">
                  <p class="cn-forms-ingestionproposalsheet-1053-1">{title}</p>
                  <p class="cn-forms-ingestionproposalsheet-1054-1">
                    Source: {proposal.transaction?.merchant ??
                      proposal.transaction?.narration ??
                      "—"}
                  </p>
                  {#if merchant?.domain || merchant?.industry}
                    <p class="cn-forms-ingestionproposalsheet-1060-1">
                      {[merchant?.domain, merchant?.industry]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  {/if}
                  {#if merchant?.description}
                    <p class="cn-forms-ingestionproposalsheet-1067-1">
                      {merchant.description}
                    </p>
                  {/if}
                  {#if merchantProvenance()}
                    <p class="cn-forms-ingestionproposalsheet-1072-1">
                      Provenance: {merchantProvenance()}
                    </p>
                  {/if}
                  <p class="cn-forms-ingestionproposalsheet-1076-1">
                    {merchantStatus}
                    {#if proposal.merchantResolution?.explanation}
                      · {proposal.merchantResolution.explanation}
                    {/if}
                  </p>
                  {#if !readOnly && merchantStatus === "suggested" && candidate}
                    <div class="cn-forms-ingestionproposalsheet-1083-1">
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
                      merchants={localMerchants}
                      emptyOption={localMerchantEmptyOption}
                      domain={correctionDomain}
                      searchText={`${correctionName} ${correctionDomain}`.trim()}
                      searchAction={localMerchantSearchAction}
                      searchActionGroupLabel={localMerchantSearchActionLabel}
                      onSearchAction={onLocalMerchantSearchAction}
                      messages={localMerchantMessages}
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
                <div class="cn-forms-ingestionproposalsheet-1191-1">
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

        <section class="cn-forms-ingestionproposalsheet-1219-1">
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
                {#if proposal.transaction?.providerCategory}
                  {@const providerCategory =
                    proposal.transaction.providerCategory}
                  <FormField
                    label="Bank category"
                    as="div"
                    align="center"
                    controlId="ingestion-provider-category"
                  >
                    <output id="ingestion-provider-category"
                      >{providerCategory.label} · {providerCategory.code}</output
                    >
                  </FormField>
                {/if}
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
                        ? "cn-forms-ingestionproposalsheet-1339-1"
                        : undefined}
                    >
                      <TagEditor
                        id="ingestion-tags"
                        value={draft.tags}
                        suggestions={[...tags]}
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
          <section
            class="cn-forms-ingestionproposalsheet-1376-1"
            aria-label="Metadata"
          >
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
