<script lang="ts">
  import { onMount } from "svelte";
  import { ChevronsDownUp } from "@lucide/svelte";
  import { ChevronsUpDown } from "@lucide/svelte";
  import { CircleAlert } from "@lucide/svelte";
  import { Sparkles } from "@lucide/svelte";
  import { X } from "@lucide/svelte";
  import { FormField, FormSectionHeader } from "@lapismd/design-core/forms";
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import * as Sheet from "@lapismd/design-core/shadcn/sheet";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import { urlFor } from "../helpers";
  import { useIngestionApi, ingestionPath } from "../ingestion/api";
  const { ingestionJson } = useIngestionApi();
  import LocalMerchantMatchPicker from "./LocalMerchantMatchPicker.svelte";

  type Props = {
    open?: boolean;
    projectId: string;
    sourceId?: string;
    cluster: MerchantReviewCluster;
    onClosed?: () => void;
    onUpdated?: () => void;
    onStatus?: (message: string) => void;
  };

  let {
    open = $bindable(false),
    projectId,
    sourceId = "",
    cluster,
    onClosed,
    onUpdated,
    onStatus,
  }: Props = $props();

  let busy = $state(false);
  let errors = $state<string[]>([]);
  let selectedCandidateId = $state("");
  let correcting = $state(false);
  let correctionName = $state("");
  let correctionDomain = $state("");
  let correctionDescription = $state("");
  let attachedMerchantId = $state("");
  let failedLogo = $state(false);
  let sheetTitleEl = $state<HTMLElement | null>(null);
  let openSections = $state<Record<string, boolean>>({
    merchant: true,
    suggestion: true,
    labels: true,
    transactions: true,
  });

  const candidate = $derived(
    cluster.candidates.find((item) => item.id === selectedCandidateId) ??
      cluster.candidates[0],
  );
  const primaryStatus = $derived(cluster.statuses[0] ?? "unresolved");
  const normalizedLabels = $derived(
    cluster.members.map((member) => member.normalizedLabel),
  );
  const sectionsCollapsedAll = $derived(
    Object.values(openSections).every((open) => open === false),
  );
  const sectionTitleClass =
    "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  let wasOpen = $state(false);
  $effect(() => {
    if (wasOpen && !open) onClosed?.();
    wasOpen = open;
  });

  function reviewHref(tx: MerchantReviewCluster["transactions"][number]) {
    return urlFor("/records", {
      sourceId: sourceId || undefined,
      runId: tx.runId,
      proposalId: tx.proposalId,
    });
  }

  onMount(() => {
    const first = cluster.candidates[0];
    selectedCandidateId = first?.id ?? "";
    correctionName = first?.canonicalName ?? cluster.displayName ?? "";
    correctionDomain = first?.domain ?? cluster.domain ?? "";
    correctionDescription = first?.description ?? "";
    attachedMerchantId = "";
  });

  function isSectionOpen(id: string) {
    return openSections[id] !== false;
  }

  function toggleSection(id: string) {
    openSections = { ...openSections, [id]: !isSectionOpen(id) };
  }

  function toggleCollapseAll() {
    const next = !sectionsCollapsedAll;
    openSections = {
      merchant: !next,
      suggestion: !next,
      labels: !next,
      transactions: !next,
    };
  }

  function startCorrection() {
    correcting = true;
    correctionName = candidate?.canonicalName ?? cluster.displayName ?? "";
    if (!correctionDomain.trim()) {
      correctionDomain = candidate?.domain ?? cluster.domain ?? "";
    }
    correctionDescription = candidate?.description ?? "";
  }

  function saveDomainOnly() {
    const domain = correctionDomain.trim();
    if (!domain) return;
    if (primaryStatus === "suggested" && candidate) {
      void updateMerchant("confirm", {
        candidateId: candidate.id,
        domain,
        targetMerchantId: attachedMerchantId || undefined,
      });
      return;
    }
    const name =
      candidate?.canonicalName ?? cluster.displayName ?? correctionName;
    if (!name.trim()) return;
    void updateMerchant("correct", {
      canonicalName: name,
      domain,
      description: correctionDescription || candidate?.description || undefined,
      targetMerchantId: attachedMerchantId || undefined,
    });
  }

  async function updateMerchant(
    action: "confirm" | "correct" | "reject" | "clear-suppression",
    extra: Record<string, string | undefined> = {},
  ) {
    busy = true;
    errors = [];
    try {
      await ingestionJson(
        ingestionPath(
          projectId,
          `/runs/${encodeURIComponent(cluster.primary.runId)}/proposals/${encodeURIComponent(cluster.primary.proposalId)}/merchant`,
        ),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            normalizedLabels,
            ...extra,
          }),
        },
      );
      correcting = false;
      onUpdated?.();
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

  async function detectMerchant() {
    busy = true;
    errors = [];
    try {
      await ingestionJson(
        ingestionPath(
          projectId,
          `/runs/${encodeURIComponent(cluster.primary.runId)}/proposals/${encodeURIComponent(cluster.primary.proposalId)}/enrich`,
        ),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            merchantOnly: true,
            normalizedLabels,
          }),
        },
      );
      onUpdated?.();
      onStatus?.("Merchant detection updated pending imports.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors = [message];
      onStatus?.(message);
    } finally {
      busy = false;
    }
  }
</script>

<Sheet.Root bind:open>
  <Sheet.Content
    side="right"
    class="flex w-full flex-col gap-0 p-0 sm:max-w-2xl [&>button.absolute]:hidden"
    data-ingestion-merchant-sheet
    onOpenAutoFocus={(event) => {
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
        class="merchant-sheet-title min-w-0 flex-1 truncate leading-none outline-none"
      >
        Review Merchant
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        Confirm or correct this merchant across matching pending imports.
      </Sheet.Description>
      <div class="ml-auto flex shrink-0 items-center gap-1">
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
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon"
                class="size-8"
                aria-label="Detect merchant"
                disabled={busy}
                onclick={(event) => {
                  void detectMerchant();
                }}
              >
                <Sparkles class="size-4" />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Detect merchant</Tooltip.Content>
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
          <Alert.Title>Could not update merchant</Alert.Title>
          <Alert.Description class="whitespace-pre-wrap"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      <div class="merchant-form flex min-w-0 flex-col gap-6 pl-6">
        <section class="flex flex-col gap-2">
          <FormSectionHeader
            index={0}
            total={1}
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
            <div class="merchant-section-body">
              <div class="flex items-center gap-3">
                {#if cluster.logoUrl && !failedLogo}
                  <img
                    class="size-12 shrink-0 rounded-md border object-contain"
                    src={cluster.logoUrl}
                    alt={`${cluster.displayName} logo`}
                    onerror={() => (failedLogo = true)}
                  />
                {:else}
                  <div
                    class="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted text-sm font-medium text-muted-foreground"
                    aria-hidden="true"
                  >
                    {cluster.displayName.slice(0, 1).toUpperCase() || "?"}
                  </div>
                {/if}
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">
                    {cluster.displayName}
                  </p>
                  <p class="truncate text-xs text-muted-foreground">
                    {cluster.pendingCount} pending
                    {#if cluster.domain}
                      · {cluster.domain}
                    {/if}
                  </p>
                </div>
              </div>

              <div class="beancount-structured-form">
                <FormField label="Name" as="div">
                  <output id="merchant-cluster-name" class="truncate"
                    >{cluster.displayName}</output
                  >
                </FormField>
                <FormField label="Status" as="div">
                  <output
                    id="merchant-cluster-status"
                    class="truncate capitalize"
                    >{cluster.statuses.join(", ") || "unresolved"}</output
                  >
                </FormField>
                <FormField label="Domain" align="center">
                  {#if cluster.domain && !correcting}
                    <output id="merchant-cluster-domain" class="truncate"
                      >{cluster.domain}</output
                    >
                  {:else}
                    <Input
                      id="merchant-cluster-domain"
                      bind:value={correctionDomain}
                      placeholder="example.com"
                      disabled={busy}
                      onkeydown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        if (!cluster.domain) saveDomainOnly();
                      }}
                    />
                  {/if}
                </FormField>
                <FormField label="Pending" as="div">
                  <output id="merchant-cluster-pending"
                    >{cluster.pendingCount}</output
                  >
                </FormField>
                {#if cluster.explanation}
                  <FormField label="Notes" as="div">
                    <output id="merchant-cluster-notes"
                      >{cluster.explanation}</output
                    >
                  </FormField>
                {/if}
                {#if primaryStatus !== "suppressed"}
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
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                {#if primaryStatus === "suggested" && candidate}
                  <Button
                    size="sm"
                    disabled={busy}
                    onclick={() =>
                      void updateMerchant("confirm", {
                        candidateId: candidate.id,
                        domain: correctionDomain.trim() || undefined,
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
                    onclick={() => void updateMerchant("reject")}
                    >Dismiss</Button
                  >
                {:else if primaryStatus === "suppressed"}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onclick={() => void updateMerchant("clear-suppression")}
                    >Try again</Button
                  >
                {:else}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onclick={startCorrection}>Set merchant</Button
                  >
                {/if}
              </div>

              {#if correcting}
                <div class="beancount-structured-form">
                  <FormField label="Name" align="center">
                    <Input
                      id="merchant-review-name"
                      bind:value={correctionName}
                      placeholder="Merchant name"
                    />
                  </FormField>
                  <FormField label="Description" align="center">
                    <Input
                      id="merchant-review-description"
                      bind:value={correctionDescription}
                      placeholder="Description"
                    />
                  </FormField>
                </div>
                <div class="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    disabled={busy || !correctionName.trim()}
                    onclick={() =>
                      void updateMerchant("correct", {
                        canonicalName: correctionName,
                        domain: correctionDomain || undefined,
                        description: correctionDescription || undefined,
                        targetMerchantId: attachedMerchantId || undefined,
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

        {#if cluster.candidates.length}
          <section class="flex flex-col gap-2">
            <FormSectionHeader
              index={0}
              total={1}
              title="Suggestions"
              titleClass={sectionTitleClass}
              editable={false}
              movable={false}
              removable={false}
              titleToggleable={true}
              open={isSectionOpen("suggestion")}
              onToggle={() => toggleSection("suggestion")}
            />
            {#if isSectionOpen("suggestion")}
              <div class="merchant-section-body flex flex-col gap-2">
                {#each cluster.candidates as item (item.id)}
                  <button
                    type="button"
                    class="flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm {selectedCandidateId ===
                    item.id
                      ? 'border-primary bg-accent'
                      : 'hover:bg-muted/50'}"
                    onclick={() => (selectedCandidateId = item.id)}
                  >
                    {#if item.logoUrl}
                      <img
                        class="size-9 shrink-0 rounded-md border object-contain"
                        src={item.logoUrl}
                        alt=""
                      />
                    {/if}
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-medium"
                        >{item.canonicalName}</span
                      >
                      <span
                        class="block truncate text-xs text-muted-foreground"
                      >
                        {[item.domain, item.industry]
                          .filter(Boolean)
                          .join(" · ") || item.explanation}
                      </span>
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </section>
        {/if}

        <section class="flex flex-col gap-2">
          <FormSectionHeader
            index={0}
            total={1}
            title="Labels"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("labels")}
            onToggle={() => toggleSection("labels")}
          />
          {#if isSectionOpen("labels")}
            <div class="merchant-section-body">
              <div class="beancount-structured-form">
                {#each cluster.members as member (member.normalizedLabel)}
                  <FormField label="Source" as="div">
                    <output
                      id={`merchant-label-${member.normalizedLabel}`}
                      class="truncate"
                      >{member.rawLabel}
                      <span class="tabular-nums text-muted-foreground">
                        · {member.count}</span
                      ></output
                    >
                  </FormField>
                {/each}
              </div>
            </div>
          {/if}
        </section>

        <section class="flex flex-col gap-2">
          <FormSectionHeader
            index={0}
            total={1}
            title="Matching transactions"
            titleClass={sectionTitleClass}
            editable={false}
            movable={false}
            removable={false}
            titleToggleable={true}
            open={isSectionOpen("transactions")}
            onToggle={() => toggleSection("transactions")}
          />
          {#if isSectionOpen("transactions")}
            <div class="merchant-section-body">
              {#if !cluster.transactions.length}
                <p class="text-sm text-muted-foreground">
                  No matching pending transactions.
                </p>
              {:else}
                <div
                  class="overflow-hidden rounded-xl border bg-card shadow-sm"
                >
                  {#each cluster.transactions as tx, index (tx.proposalId)}
                    <a
                      href={reviewHref(tx)}
                      class:rounded-b-xl={index ===
                        cluster.transactions.length - 1}
                      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-[15px] py-3 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open review for ${tx.narration || tx.payee || tx.rawLabel}`}
                    >
                      <div class="min-w-0">
                        <div class="truncate text-sm font-semibold">
                          {tx.narration || tx.payee || tx.rawLabel}
                        </div>
                        <div
                          class="mt-1 truncate text-xs text-muted-foreground"
                        >
                          {tx.bookedAt} · {tx.sourceAccount}
                        </div>
                      </div>
                      <span class="text-sm font-semibold tabular-nums">
                        {tx.amount}
                        {tx.currency}
                      </span>
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </section>
      </div>
    </div>
  </Sheet.Content>
</Sheet.Root>

<style>
  .merchant-form :global(.beancount-structured-form) {
    min-width: 0;
  }

  .merchant-section-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-left: 0.5rem;
    min-width: 0;
  }

  :global(.merchant-sheet-title),
  .merchant-form :global(.beancount-form-item-list-toggle),
  .merchant-form :global(.beancount-form-section-title-toggle),
  .merchant-form :global(.beancount-form-section-title-row h3) {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>
