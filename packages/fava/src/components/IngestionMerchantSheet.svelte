<script lang="ts">
  import { onMount } from "svelte";
  import { Decimal } from "@beancount-js/parser";
  import ArrowDownWideNarrow from "lucide-svelte/icons/arrow-down-wide-narrow";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import ArrowUpNarrowWide from "lucide-svelte/icons/arrow-up-narrow-wide";
  import ChevronsDownUp from "lucide-svelte/icons/chevrons-down-up";
  import ChevronsUpDown from "lucide-svelte/icons/chevrons-up-down";
  import CircleAlert from "lucide-svelte/icons/circle-alert";
  import Sparkles from "lucide-svelte/icons/sparkles";
  import X from "lucide-svelte/icons/x";
  import { FormField, FormSectionHeader } from "@beancount-js/forms";
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Table from "$lib/components/ui/table";
  import * as Alert from "$lib/components/ui/alert";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import { useNavigation } from "../router/router";
  import LocalMerchantMatchPicker from "./LocalMerchantMatchPicker.svelte";
  import PagePagination from "./PagePagination.svelte";

  type TransactionSortKey = "date" | "transaction" | "account" | "amount";
  type SortOrder = "none" | "asc" | "desc";

  const MATCHING_TRANSACTION_PAGE_SIZE = 10;
  const MATCHING_TRANSACTION_COLUMNS: Array<{
    key: TransactionSortKey;
    label: string;
    rightAligned?: boolean;
  }> = [
    { key: "date", label: "Date" },
    { key: "transaction", label: "Transaction" },
    { key: "account", label: "Account" },
    { key: "amount", label: "Amount", rightAligned: true },
  ];
  const SORT_CYCLE: Record<SortOrder, SortOrder> = {
    none: "asc",
    asc: "desc",
    desc: "none",
  };

  type Props = {
    open?: boolean;
    projectId: string;
    sourceId?: string;
    cluster: MerchantReviewCluster;
    readOnly?: boolean;
    onClosed?: () => void;
    onUpdated?: () => void;
    onStatus?: (message: string) => void;
  };

  let {
    open = $bindable(false),
    projectId,
    sourceId = "",
    cluster,
    readOnly = false,
    onClosed,
    onUpdated,
    onStatus,
  }: Props = $props();

  const { router } = useNavigation();

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
  let matchingTransactionPage = $state(1);
  let matchingTransactionSortKey = $state<TransactionSortKey | null>(null);
  let matchingTransactionSortOrder = $state<SortOrder>("none");
  let previousClusterId = $state("");
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
  const sortedMatchingTransactions = $derived.by(() => {
    if (
      !matchingTransactionSortKey ||
      matchingTransactionSortOrder === "none"
    ) {
      return cluster.transactions;
    }

    const direction = matchingTransactionSortOrder === "asc" ? 1 : -1;
    const key = matchingTransactionSortKey;
    return [...cluster.transactions].sort((left, right) => {
      const comparison =
        key === "date"
          ? left.bookedAt.localeCompare(right.bookedAt)
          : key === "transaction"
            ? matchingTransactionLabel(left).localeCompare(
                matchingTransactionLabel(right),
                undefined,
                { sensitivity: "base" },
              )
            : key === "account"
              ? left.sourceAccount.localeCompare(
                  right.sourceAccount,
                  undefined,
                  {
                    sensitivity: "base",
                  },
                )
              : compareTransactionAmounts(left.amount, right.amount);
      return direction * comparison;
    });
  });
  const matchingTransactionPageCount = $derived(
    Math.max(
      1,
      Math.ceil(
        sortedMatchingTransactions.length / MATCHING_TRANSACTION_PAGE_SIZE,
      ),
    ),
  );
  const matchingTransactionPageStart = $derived(
    (matchingTransactionPage - 1) * MATCHING_TRANSACTION_PAGE_SIZE,
  );
  const matchingTransactionPageEnd = $derived(
    Math.min(
      matchingTransactionPageStart + MATCHING_TRANSACTION_PAGE_SIZE,
      sortedMatchingTransactions.length,
    ),
  );
  const visibleMatchingTransactions = $derived(
    sortedMatchingTransactions.slice(
      matchingTransactionPageStart,
      matchingTransactionPageEnd,
    ),
  );

  let wasOpen = $state(false);
  $effect(() => {
    if (wasOpen && !open) onClosed?.();
    wasOpen = open;
  });

  $effect(() => {
    if (matchingTransactionPage > matchingTransactionPageCount) {
      matchingTransactionPage = matchingTransactionPageCount;
    }
  });

  $effect(() => {
    if (cluster.id === previousClusterId) return;
    previousClusterId = cluster.id;
    matchingTransactionPage = 1;
    matchingTransactionSortKey = null;
    matchingTransactionSortOrder = "none";
  });

  function openReview(tx: MerchantReviewCluster["transactions"][number]) {
    const query = new URLSearchParams({
      runId: tx.runId,
      proposalId: tx.proposalId,
    });
    if (sourceId) query.set("sourceId", sourceId);
    router.push(`/records?${query}`);
  }

  function handleMatchingTransactionKeydown(
    event: KeyboardEvent,
    tx: MerchantReviewCluster["transactions"][number],
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openReview(tx);
  }

  function matchingTransactionLabel(
    tx: MerchantReviewCluster["transactions"][number],
  ) {
    return tx.narration || tx.payee || tx.rawLabel || "Untitled transaction";
  }

  function compareTransactionAmounts(left: string, right: string) {
    const leftAmount = new Decimal(left);
    const rightAmount = new Decimal(right);
    if (leftAmount.eq(rightAmount)) return 0;
    return leftAmount.lt(rightAmount) ? -1 : 1;
  }

  function cycleMatchingTransactionSort(key: TransactionSortKey) {
    if (matchingTransactionSortKey !== key) {
      matchingTransactionSortKey = key;
      matchingTransactionSortOrder = "asc";
    } else {
      matchingTransactionSortOrder = SORT_CYCLE[matchingTransactionSortOrder];
      if (matchingTransactionSortOrder === "none") {
        matchingTransactionSortKey = null;
      }
    }
    matchingTransactionPage = 1;
  }

  function matchingTransactionAriaSort(
    key: TransactionSortKey,
  ): "ascending" | "descending" | "none" {
    if (matchingTransactionSortKey !== key) return "none";
    if (matchingTransactionSortOrder === "asc") return "ascending";
    if (matchingTransactionSortOrder === "desc") return "descending";
    return "none";
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
    if (readOnly) return;
    correcting = true;
    correctionName = candidate?.canonicalName ?? cluster.displayName ?? "";
    if (!correctionDomain.trim()) {
      correctionDomain = candidate?.domain ?? cluster.domain ?? "";
    }
    correctionDescription = candidate?.description ?? "";
  }

  function saveDomainOnly() {
    if (readOnly) return;
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
    if (readOnly) return;
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
    if (readOnly) return;
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
        {readOnly ? "Merchant details" : "Review Merchant"}
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        {readOnly
          ? "View accepted merchant details for this active ingest."
          : "Confirm or correct this merchant across matching pending imports."}
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
        {#if !readOnly}
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
        {/if}
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
                    {cluster.pendingCount} {readOnly ? "reviewed" : "pending"}
                    {#if cluster.domain}
                      · {cluster.domain}
                    {/if}
                  </p>
                </div>
              </div>

              <div class="beancount-structured-form">
                <FormField
                  label="Name"
                  as="div"
                  controlId="merchant-cluster-name"
                >
                  <output id="merchant-cluster-name" class="truncate"
                    >{cluster.displayName}</output
                  >
                </FormField>
                <FormField
                  label="Status"
                  as="div"
                  controlId="merchant-cluster-status"
                >
                  <output
                    id="merchant-cluster-status"
                    class="truncate capitalize"
                    >{cluster.statuses.join(", ") || "unresolved"}</output
                  >
                </FormField>
                <FormField
                  label="Domain"
                  align="center"
                  controlId="merchant-cluster-domain"
                >
                  {#if readOnly || (cluster.domain && !correcting)}
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
                <FormField
                  label={readOnly ? "Reviewed" : "Pending"}
                  as="div"
                  controlId="merchant-cluster-pending"
                >
                  <output id="merchant-cluster-pending"
                    >{cluster.pendingCount}</output
                  >
                </FormField>
                {#if cluster.explanation}
                  <FormField
                    label="Notes"
                    as="div"
                    controlId="merchant-cluster-notes"
                  >
                    <output id="merchant-cluster-notes"
                      >{cluster.explanation}</output
                    >
                  </FormField>
                {/if}
                {#if !readOnly && primaryStatus !== "suppressed"}
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

              {#if !readOnly}
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
                  <FormField
                    label="Name"
                    align="center"
                    controlId="merchant-review-name"
                  >
                    <Input
                      id="merchant-review-name"
                      bind:value={correctionName}
                      placeholder="Merchant name"
                    />
                  </FormField>
                  <FormField
                    label="Description"
                    align="center"
                    controlId="merchant-review-description"
                  >
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
              {/if}
            </div>
          {/if}
        </section>

        {#if cluster.candidates.length}
          <section class="flex flex-col gap-2">
            <FormSectionHeader
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
                  <FormField
                    label="Source"
                    as="div"
                    controlId={`merchant-label-${member.normalizedLabel}`}
                  >
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
                  <Table.Root class="min-w-[44rem]">
                    <Table.Header class="bg-muted/40">
                      <Table.Row class="hover:bg-transparent">
                        {#each MATCHING_TRANSACTION_COLUMNS as column (column.key)}
                          <Table.Head
                            scope="col"
                            aria-sort={matchingTransactionAriaSort(column.key)}
                            class={column.rightAligned
                              ? "p-0 text-right"
                              : "p-0"}
                          >
                            <button
                              type="button"
                              class="inline-flex h-10 w-full items-center gap-1.5 rounded-md px-4 text-left text-xs font-semibold uppercase tracking-wide outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                              class:justify-end={column.rightAligned}
                              class:text-right={column.rightAligned}
                              aria-label={`Sort matching transactions by ${column.label.toLowerCase()}`}
                              onclick={() =>
                                cycleMatchingTransactionSort(column.key)}
                            >
                              {column.label}
                              {#if matchingTransactionSortKey === column.key && matchingTransactionSortOrder === "asc"}
                                <ArrowUpNarrowWide
                                  class="size-3.5"
                                  aria-hidden="true"
                                />
                              {:else if matchingTransactionSortKey === column.key && matchingTransactionSortOrder === "desc"}
                                <ArrowDownWideNarrow
                                  class="size-3.5"
                                  aria-hidden="true"
                                />
                              {:else}
                                <ArrowUpDown
                                  class="size-3.5 opacity-50"
                                  aria-hidden="true"
                                />
                              {/if}
                            </button>
                          </Table.Head>
                        {/each}
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {#each visibleMatchingTransactions as tx (tx.proposalId)}
                        <Table.Row
                          class="cursor-pointer"
                          role="link"
                          tabindex={0}
                          aria-label={`Open review for ${matchingTransactionLabel(tx)}`}
                          onclick={() => openReview(tx)}
                          onkeydown={(event) =>
                            handleMatchingTransactionKeydown(event, tx)}
                        >
                          <Table.Cell
                            class="whitespace-nowrap px-4 py-3 text-muted-foreground"
                            >{tx.bookedAt}</Table.Cell
                          >
                          <Table.Cell class="min-w-52 px-4 py-3">
                            <span class="block truncate font-medium text-foreground"
                              >{matchingTransactionLabel(tx)}</span
                            >
                          </Table.Cell>
                          <Table.Cell
                            class="min-w-64 whitespace-nowrap px-4 py-3 text-muted-foreground"
                            >{tx.sourceAccount}</Table.Cell
                          >
                          <Table.Cell
                            class="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-foreground"
                            >{tx.amount} {tx.currency}</Table.Cell
                          >
                        </Table.Row>
                      {/each}
                    </Table.Body>
                  </Table.Root>
                </div>
                <div
                  class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  data-merchant-matching-transaction-pagination
                >
                  <span class="text-sm text-muted-foreground"
                    >Showing {matchingTransactionPageStart +
                      1}&ndash;{matchingTransactionPageEnd} of {sortedMatchingTransactions.length}</span
                  >
                  <PagePagination
                    page={matchingTransactionPage}
                    pageCount={matchingTransactionPageCount}
                    ariaLabel="Matching transaction pages"
                    onPageChange={(nextPage) =>
                      (matchingTransactionPage = nextPage)}
                  />
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
