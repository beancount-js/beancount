<script lang="ts">
  import type { ImportProposal, IngestionRun } from "../ingestion/types";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Sheet from "$lib/components/ui/sheet";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import Minus from "lucide-svelte/icons/minus";
  import Plus from "lucide-svelte/icons/plus";
  import ComboBox from "./ComboBox.svelte";

  type MetadataRow = { key: string; value: string };

  type ProposalDraft = {
    bookedAt: string;
    amount: string;
    currency: string;
    payee: string;
    narration: string;
    selectedAccount: string;
    tags: string;
    links: string;
    metadata: MetadataRow[];
  };

  type Props = {
    open?: boolean;
    proposal: ImportProposal;
    runId: string;
    projectId: string;
    allowedAccounts?: readonly string[];
    onUpdated?: (run: IngestionRun) => void;
    onStatus?: (message: string) => void;
  };

  let {
    open = $bindable(false),
    proposal,
    runId,
    projectId,
    allowedAccounts = [],
    onUpdated,
    onStatus,
  }: Props = $props();

  let draft = $state<ProposalDraft>(emptyDraft());
  let loadedKey = $state("");
  let correcting = $state(false);
  let correctionName = $state("");
  let correctionDomain = $state("");
  let correctionDescription = $state("");
  let failedLogo = $state(false);
  let saving = $state(false);
  let busy = $state(false);
  let errors = $state<string[]>([]);

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
    Boolean(proposal.transaction) &&
      (proposal.status === "ready" || proposal.status === "needs-review"),
  );

  function emptyDraft(): ProposalDraft {
    return {
      bookedAt: "",
      amount: "",
      currency: "",
      payee: "",
      narration: "",
      selectedAccount: "",
      tags: "",
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
    const tx = next.transaction;
    const details = detailsFor(next);
    draft = {
      bookedAt: tx?.bookedAt ?? "",
      amount: tx?.amount ?? "",
      currency: tx?.currency ?? "",
      payee: tx?.payee ?? "",
      narration: tx?.narration ?? "",
      selectedAccount: next.selectedAccount ?? "",
      tags: (tx?.tags ?? []).join(", "),
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
    failedLogo = false;
    errors = [];
  }

  $effect(() => {
    const key = `${runId}:${proposal.id}:${proposal.status}:${proposal.selectedAccount ?? ""}:${proposal.transaction?.bookedAt ?? ""}:${proposal.transaction?.amount ?? ""}:${proposal.merchantResolution?.status ?? ""}`;
    if (key === loadedKey) return;
    loadedKey = key;
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
  }

  function removeMetadataRow(index: number) {
    draft.metadata = draft.metadata.filter((_, i) => i !== index);
  }

  async function updateMerchant(
    action: "confirm" | "correct" | "reject" | "clear-suppression",
    extra: Record<string, string | undefined> = {},
  ) {
    busy = true;
    errors = [];
    try {
      const run = await ingestionJson<IngestionRun>(
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
      onUpdated?.(run);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors = [message];
      onStatus?.(message);
    } finally {
      busy = false;
    }
  }

  async function save() {
    if (!editable) return;
    saving = true;
    errors = [];
    try {
      const metadata: Record<string, string> = {};
      for (const row of draft.metadata) {
        const key = row.key.trim();
        if (!key) continue;
        metadata[key] = row.value;
      }
      const run = await ingestionJson<IngestionRun>(
        ingestionPath(projectId, `/runs/${encodeURIComponent(runId)}`),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            proposalId: proposal.id,
            account: draft.selectedAccount || undefined,
            transaction: {
              bookedAt: draft.bookedAt,
              amount: draft.amount,
              currency: draft.currency,
              merchant: proposal.transaction?.merchant,
              payee: draft.payee,
              narration: draft.narration,
              tags: tokens(draft.tags),
              links: tokens(draft.links),
              metadata,
            },
          }),
        },
      );
      onUpdated?.(run);
      open = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors = [message];
      onStatus?.(message);
    } finally {
      saving = false;
    }
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="right"
    class="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
    data-ingestion-proposal-sheet
  >
    <Sheet.Header class="border-b px-6 py-5 pr-14">
      <Sheet.Title>Review proposal</Sheet.Title>
      <Sheet.Description>
        Edit transaction details, confirm the merchant, then save before
        accepting.
      </Sheet.Description>
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

      <section class="mb-6 flex gap-3" aria-label="Merchant">
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
        <div class="min-w-0 flex-1">
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
            <p class="mt-1 line-clamp-3 text-xs text-muted-foreground">
              {merchant.description}
            </p>
          {/if}
          {#if merchantProvenance()}
            <p class="mt-1 text-xs text-muted-foreground">
              Provenance: {merchantProvenance()}
            </p>
          {/if}
          <p class="mt-1 text-xs text-muted-foreground">
            {merchantStatus}
            {#if proposal.merchantResolution?.explanation}
              · {proposal.merchantResolution.explanation}
            {/if}
          </p>
          {#if merchantStatus === "suggested" && candidate}
            <div class="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onclick={() =>
                  updateMerchant("confirm", { candidateId: candidate.id })}
                >Confirm</Button
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
          {:else if merchantStatus === "suppressed"}
            <div class="mt-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onclick={() => updateMerchant("clear-suppression")}
                >Try again</Button
              >
            </div>
          {:else}
            <div class="mt-2">
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
          {#if correcting}
            <div
              class="mt-3 flex flex-col gap-2 rounded-md border bg-muted/30 p-3"
            >
              <Input
                aria-label="Merchant name"
                bind:value={correctionName}
                placeholder="Merchant name"
              />
              <Input
                aria-label="Merchant domain"
                bind:value={correctionDomain}
                placeholder="example.com (optional)"
              />
              <Input
                aria-label="Merchant description"
                bind:value={correctionDescription}
                placeholder="Description (optional)"
              />
              <div class="flex gap-2">
                <Button
                  size="sm"
                  disabled={busy || !correctionName.trim()}
                  onclick={() =>
                    updateMerchant("correct", {
                      canonicalName: correctionName,
                      domain: correctionDomain || undefined,
                      description: correctionDescription || undefined,
                      targetMerchantId:
                        proposal.merchantResolution?.status === "confirmed"
                          ? proposal.merchantResolution.merchant.merchantId
                          : undefined,
                    })}>Save merchant</Button
                >
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onclick={() => (correcting = false)}>Cancel</Button
                >
              </div>
            </div>
          {/if}
        </div>
      </section>

      <form
        class="flex flex-col gap-6"
        onsubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="grid gap-2 text-sm font-medium" for="ingestion-booked-at">
            Date
            <Input
              id="ingestion-booked-at"
              type="date"
              bind:value={draft.bookedAt}
              disabled={!editable}
            />
          </label>
          <label class="grid gap-2 text-sm font-medium" for="ingestion-amount">
            Amount
            <Input
              id="ingestion-amount"
              inputmode="decimal"
              bind:value={draft.amount}
              disabled={!editable}
            />
          </label>
          <label class="grid gap-2 text-sm font-medium" for="ingestion-currency">
            Currency
            <Input
              id="ingestion-currency"
              bind:value={draft.currency}
              disabled={!editable}
            />
          </label>
        </div>

        <label class="grid gap-2 text-sm font-medium" for="ingestion-payee">
          Payee
          <Input
            id="ingestion-payee"
            bind:value={draft.payee}
            disabled={!editable}
          />
        </label>

        <label class="grid gap-2 text-sm font-medium" for="ingestion-narration">
          Narration
          <Input
            id="ingestion-narration"
            bind:value={draft.narration}
            disabled={!editable}
          />
        </label>

        <label class="grid gap-2 text-sm font-medium">
          Account
          <ComboBox
            items={accountItems}
            value={draft.selectedAccount}
            placeholder="Choose an account"
            onValueChange={(value) => (draft.selectedAccount = value)}
          />
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="grid gap-2 text-sm font-medium" for="ingestion-tags">
            Tags
            <Input
              id="ingestion-tags"
              placeholder="tax, reimbursable"
              bind:value={draft.tags}
              disabled={!editable}
            />
          </label>
          <label class="grid gap-2 text-sm font-medium" for="ingestion-links">
            Links
            <Input
              id="ingestion-links"
              placeholder="receipt-123"
              bind:value={draft.links}
              disabled={!editable}
            />
          </label>
        </div>

        <section class="flex flex-col gap-3" aria-labelledby="ingestion-meta-heading">
          <div class="flex items-center justify-between gap-3">
            <h3 id="ingestion-meta-heading" class="text-sm font-semibold">
              Metadata
            </h3>
            <Button
              size="sm"
              variant="outline"
              disabled={!editable}
              onclick={addMetadataRow}
            >
              <Plus data-icon="inline-start" />
              Add field
            </Button>
          </div>
          {#if !draft.metadata.length}
            <p class="text-xs text-muted-foreground">No metadata fields.</p>
          {/if}
          {#each draft.metadata as row, index (index)}
            <div
              class="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
            >
              <label class="grid gap-2 text-sm font-medium">
                Key
                <Input bind:value={row.key} disabled={!editable} />
              </label>
              <label class="grid gap-2 text-sm font-medium">
                Value
                <Input bind:value={row.value} disabled={!editable} />
              </label>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove metadata ${index + 1}`}
                disabled={!editable}
                onclick={() => removeMetadataRow(index)}
              >
                <Minus />
              </Button>
            </div>
          {/each}
        </section>
      </form>
    </div>

    <Sheet.Footer class="border-t px-6 py-4 sm:gap-2">
      <Sheet.Close
        class="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent"
      >
        Cancel
      </Sheet.Close>
      <Button type="button" disabled={saving || !editable} onclick={save}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </Sheet.Footer>
  </Sheet.Content>
</Sheet.Root>
