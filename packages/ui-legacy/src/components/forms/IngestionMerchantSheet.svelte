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
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import { Button } from "../shadcn/button";
  import { Input } from "../shadcn/input";
  import * as Alert from "../shadcn/alert";
  import * as Sheet from "../shadcn/sheet";
  import * as Tooltip from "../shadcn/tooltip";
  import * as Table from "../shadcn/table";
  import type {
    FilterCommandSearchAction,
    FilterCommandOption,
  } from "./picker-options";
  import FormField from "./FormField.svelte";
  import FormSectionHeader from "./FormSectionHeader.svelte";
  import type { MerchantPickerMerchant } from "./MerchantPicker.svelte";
  import LocalMerchantMatchPicker from "./LocalMerchantMatchPicker.svelte";
  import PagePagination from "../navigation/PagePagination.svelte";

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

  type MerchantSheetUpdatePayload = {
    action: "confirm" | "correct" | "reject" | "clear-suppression";
    normalizedLabels: readonly string[];
    candidateId?: string;
    canonicalName?: string;
    domain?: string;
    description?: string;
    targetMerchantId?: string;
  };

  type Props = {
    open?: boolean;
    cluster: MerchantReviewCluster;
    readOnly?: boolean;
    attachedMerchantId?: string;
    localMerchants?: readonly MerchantPickerMerchant[];
    localMerchantMessages?: readonly string[];
    localMerchantSearchAction?: (
      search: string,
    ) => FilterCommandSearchAction | null | undefined;
    localMerchantSearchActionLabel?: string;
    onLocalMerchantSearchAction?: (search: string) => Promise<void> | void;
    onClosed?: () => void;
    onUpdated?: () => void;
    onStatus?: (message: string) => void;
    onOpenReview?: (tx: MerchantReviewCluster["transactions"][number]) => void;
    onUpdateMerchant?: (
      request: MerchantSheetUpdatePayload,
    ) => Promise<void> | void;
    onDetectMerchant?: (
      normalizedLabels: readonly string[],
    ) => Promise<void> | void;
  };

  let {
    open = $bindable(false),
    cluster,
    readOnly = false,
    localMerchants = [],
    localMerchantMessages = [],
    attachedMerchantId = $bindable(""),
    localMerchantSearchAction,
    localMerchantSearchActionLabel = "Brand Match",
    onLocalMerchantSearchAction,
    onClosed,
    onOpenReview = () => {},
    onUpdateMerchant,
    onDetectMerchant,
    onUpdated,
    onStatus,
  }: Props = $props();

  const localMerchantEmptyOption: FilterCommandOption = {
    value: "",
    label: "Create new merchant",
    description: "Save the merchant details from this transaction.",
  };

  let busy = $state(false);
  let errors = $state<string[]>([]);
  let selectedCandidateId = $state("");
  let correcting = $state(false);
  let correctionName = $state("");
  let correctionDomain = $state("");
  let correctionDescription = $state("");
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
      cluster.primaryCandidate ??
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
    "cn-form-section-title cn-form-section-title--muted";
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
    onOpenReview?.(tx);
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

  function updateMessageForAction(
    action: "confirm" | "correct" | "reject" | "clear-suppression",
  ) {
    return action === "confirm" || action === "correct"
      ? "Merchant confirmed across pending imports."
      : action === "reject"
        ? "Merchant dismissed for matching labels."
        : "Merchant enrichment cleared.";
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
      await onUpdateMerchant({
        action,
        normalizedLabels,
        ...extra,
      });
      correcting = false;
      onUpdated?.();
      onStatus?.(updateMessageForAction(action));
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
    if (!onDetectMerchant) {
      errors = ["No detect handler is configured."];
      return;
    }
    busy = true;
    errors = [];
    try {
      await onDetectMerchant(normalizedLabels);
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
    class="cn-forms-ingestionmerchantsheet-391-1"
    data-ingestion-merchant-sheet
    onOpenAutoFocus={(event) => {
      event.preventDefault();
      sheetTitleEl?.focus();
    }}
  >
    <Sheet.Header class="cn-forms-ingestionmerchantsheet-399-1">
      <Sheet.Title
        bind:ref={sheetTitleEl}
        tabindex={-1}
        class="cn-forms-ingestionmerchantsheet-404-1 merchant-sheet-title"
      >
        {readOnly ? "Merchant details" : "Review Merchant"}
      </Sheet.Title>
      <Sheet.Description class="sr-only">
        {readOnly
          ? "View accepted merchant details for this active ingest."
          : "Confirm or correct this merchant across matching pending imports."}
      </Sheet.Description>
      <div class="cn-forms-ingestionmerchantsheet-413-1">
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon"
                class="cn-forms-ingestionmerchantsheet-422-1"
                aria-label={sectionsCollapsedAll
                  ? "Expand all"
                  : "Collapse all"}
                onclick={(event) => {
                  toggleCollapseAll();
                }}
              >
                {#if sectionsCollapsedAll}
                  <ChevronsUpDown
                    class="cn-forms-ingestionmerchantsheet-431-1"
                    aria-hidden="true"
                  />
                {:else}
                  <ChevronsDownUp
                    class="cn-forms-ingestionmerchantsheet-433-1"
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
        {#if !readOnly}
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="cn-forms-ingestionmerchantsheet-451-1"
                  aria-label="Detect merchant"
                  disabled={busy}
                  onclick={(event) => {
                    void detectMerchant();
                  }}
                >
                  <Sparkles class="cn-forms-ingestionmerchantsheet-458-1" />
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
                class="cn-forms-ingestionmerchantsheet-470-1"
                aria-label="Close"
              >
                <X class="cn-forms-ingestionmerchantsheet-473-1" />
                <span class="sr-only">Close</span>
              </Sheet.Close>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Close</Tooltip.Content>
        </Tooltip.Root>
      </div>
    </Sheet.Header>

    <div class="cn-forms-ingestionmerchantsheet-483-1">
      {#if errors.length}
        <Alert.Root
          variant="destructive"
          class="cn-forms-ingestionmerchantsheet-485-1"
        >
          <CircleAlert />
          <Alert.Title>Could not update merchant</Alert.Title>
          <Alert.Description class="cn-forms-ingestionmerchantsheet-488-1"
            >{errors.join("\n")}</Alert.Description
          >
        </Alert.Root>
      {/if}

      <div class="cn-forms-ingestionmerchantsheet-494-1 merchant-form">
        <section class="cn-forms-ingestionmerchantsheet-495-1">
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
              <div class="cn-forms-ingestionmerchantsheet-508-1">
                {#if cluster.logoUrl && !failedLogo}
                  <img
                    class="cn-forms-ingestionmerchantsheet-511-1"
                    src={cluster.logoUrl}
                    alt={`${cluster.displayName} logo`}
                    onerror={() => (failedLogo = true)}
                  />
                {:else}
                  <div
                    class="cn-forms-ingestionmerchantsheet-518-1"
                    aria-hidden="true"
                  >
                    {cluster.displayName.slice(0, 1).toUpperCase() || "?"}
                  </div>
                {/if}
                <div class="cn-forms-ingestionmerchantsheet-524-1">
                  <p class="cn-forms-ingestionmerchantsheet-525-1">
                    {cluster.displayName}
                  </p>
                  <p class="cn-forms-ingestionmerchantsheet-528-1">
                    {cluster.pendingCount}
                    {readOnly ? "reviewed" : "pending"}
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
                  <output
                    id="merchant-cluster-name"
                    class="cn-forms-ingestionmerchantsheet-544-1"
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
                    class="cn-forms-ingestionmerchantsheet-555-1"
                    >{cluster.statuses.join(", ") || "unresolved"}</output
                  >
                </FormField>
                <FormField
                  label="Domain"
                  align="center"
                  controlId="merchant-cluster-domain"
                >
                  {#if readOnly || (cluster.domain && !correcting)}
                    <output
                      id="merchant-cluster-domain"
                      class="cn-forms-ingestionmerchantsheet-565-1"
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
                    merchants={localMerchants}
                    domain={correctionDomain}
                    searchText={`${correctionName} ${correctionDomain}`.trim()}
                    emptyOption={localMerchantEmptyOption}
                    bind:attachedMerchantId
                    messages={localMerchantMessages}
                    searchAction={localMerchantSearchAction}
                    searchActionGroupLabel={localMerchantSearchActionLabel}
                    onSearchAction={onLocalMerchantSearchAction}
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
                <div class="cn-forms-ingestionmerchantsheet-624-1">
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
                  <div class="cn-forms-ingestionmerchantsheet-692-1">
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
          <section class="cn-forms-ingestionmerchantsheet-718-1">
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
              <div
                class="cn-forms-ingestionmerchantsheet-730-1 merchant-section-body"
              >
                {#each cluster.candidates as item (item.id)}
                  <button
                    type="button"
                    class="cn-forms-ingestionmerchantsheet-734-1 cn-forms-ingestionmerchantsheet-734-9 cn-forms-ingestionmerchantsheet-734-3 cn-forms-ingestionmerchantsheet-734-2 cn-forms-ingestionmerchantsheet-734-6 cn-forms-ingestionmerchantsheet-734-4 cn-forms-ingestionmerchantsheet-734-5 cn-forms-ingestionmerchantsheet-734-7 cn-forms-ingestionmerchantsheet-734-8 border {selectedCandidateId ===
                    item.id
                      ? 'cn-forms-ingestionmerchantsheet-736-1'
                      : 'cn-forms-ingestionmerchantsheet-737-1'}"
                    onclick={() => (selectedCandidateId = item.id)}
                  >
                    {#if item.logoUrl}
                      <img
                        class="cn-forms-ingestionmerchantsheet-742-1"
                        src={item.logoUrl}
                        alt=""
                      />
                    {/if}
                    <span class="cn-forms-ingestionmerchantsheet-747-1">
                      <span class="cn-forms-ingestionmerchantsheet-748-1"
                        >{item.canonicalName}</span
                      >
                      <span class="cn-forms-ingestionmerchantsheet-752-1">
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

        <section class="cn-forms-ingestionmerchantsheet-766-1">
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
                      class="cn-forms-ingestionmerchantsheet-788-1"
                      >{member.rawLabel}
                      <span class="cn-forms-ingestionmerchantsheet-790-1">
                        · {member.count}</span
                      ></output
                    >
                  </FormField>
                {/each}
              </div>
            </div>
          {/if}
        </section>

        <section class="cn-forms-ingestionmerchantsheet-801-1">
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
                <p class="cn-forms-ingestionmerchantsheet-815-1">
                  No matching pending transactions.
                </p>
              {:else}
                <div class="cn-forms-ingestionmerchantsheet-820-1">
                  <Table.Root class="cn-forms-ingestionmerchantsheet-822-1">
                    <Table.Header class="cn-forms-ingestionmerchantsheet-823-1">
                      <Table.Row class="cn-forms-ingestionmerchantsheet-824-1">
                        {#each MATCHING_TRANSACTION_COLUMNS as column (column.key)}
                          <Table.Head
                            scope="col"
                            aria-sort={matchingTransactionAriaSort(column.key)}
                            class={column.rightAligned
                              ? "cn-forms-ingestionmerchantsheet-830-1"
                              : "cn-forms-ingestionmerchantsheet-831-1"}
                          >
                            <button
                              type="button"
                              class="cn-forms-ingestionmerchantsheet-835-1"
                              class:cn-forms-ingestionmerchantsheet-836-1={column.rightAligned}
                              class:cn-forms-ingestionmerchantsheet-837-1={column.rightAligned}
                              aria-label={`Sort matching transactions by ${column.label.toLowerCase()}`}
                              onclick={() =>
                                cycleMatchingTransactionSort(column.key)}
                            >
                              {column.label}
                              {#if matchingTransactionSortKey === column.key && matchingTransactionSortOrder === "asc"}
                                <ArrowUpNarrowWide
                                  class="cn-forms-ingestionmerchantsheet-845-1"
                                  aria-hidden="true"
                                />
                              {:else if matchingTransactionSortKey === column.key && matchingTransactionSortOrder === "desc"}
                                <ArrowDownWideNarrow
                                  class="cn-forms-ingestionmerchantsheet-850-1"
                                  aria-hidden="true"
                                />
                              {:else}
                                <ArrowUpDown
                                  class="cn-forms-ingestionmerchantsheet-855-1"
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
                          class="cn-forms-ingestionmerchantsheet-867-1"
                          role="link"
                          tabindex={0}
                          aria-label={`Open review for ${matchingTransactionLabel(tx)}`}
                          onclick={() => openReview(tx)}
                          onkeydown={(event) =>
                            handleMatchingTransactionKeydown(event, tx)}
                        >
                          <Table.Cell
                            class="cn-forms-ingestionmerchantsheet-876-1"
                            >{tx.bookedAt}</Table.Cell
                          >
                          <Table.Cell
                            class="cn-forms-ingestionmerchantsheet-879-1"
                          >
                            <span class="cn-forms-ingestionmerchantsheet-881-1"
                              >{matchingTransactionLabel(tx)}</span
                            >
                          </Table.Cell>
                          <Table.Cell
                            class="cn-forms-ingestionmerchantsheet-886-1"
                            >{tx.sourceAccount}</Table.Cell
                          >
                          <Table.Cell
                            class="cn-forms-ingestionmerchantsheet-890-1"
                            >{tx.amount} {tx.currency}</Table.Cell
                          >
                        </Table.Row>
                      {/each}
                    </Table.Body>
                  </Table.Root>
                </div>
                <div
                  class="cn-forms-ingestionmerchantsheet-899-1"
                  data-merchant-matching-transaction-pagination
                >
                  <span class="cn-forms-ingestionmerchantsheet-902-1"
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
