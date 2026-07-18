<script lang="ts">
  import type { Amount, DirectiveBase } from "@beancount-js/beancount";
  import { DateTime } from "luxon";
  import { useContext } from "../context";
  import { useCtx } from "../stores/format";
  import { urlForAccount } from "../helpers";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import {
    buildJournalMerchantLogoMaps,
    resolveJournalMerchantLogo,
    type JournalMerchantLogo,
    type JournalMerchantLogoMaps,
  } from "../lib/journal-merchant-logos";
  import { Button } from "$lib/components/ui/button";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronUp from "lucide-svelte/icons/chevron-up";
  import ChevronsLeft from "lucide-svelte/icons/chevrons-left";
  import ChevronsRight from "lucide-svelte/icons/chevrons-right";
  import FileText from "lucide-svelte/icons/file-text";
  import Info from "lucide-svelte/icons/info";
  import {
    filterJournalGroupsByTimeframe,
    groupJournalRecords,
    journalRecords,
    orderedBalanceEntries,
    paginateJournalGroups,
    postingAmount,
    type JournalDateGroup,
    type JournalRecord,
    type JournalTimeframe,
  } from "./journal-table/model";

  const PAGE_SIZES = [25, 50, 100];
  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const { operatingCurrency } = useContext();
  const { activeRoute, router } = useNavigation();
  const ctx = useCtx();
  const { snapshot } = useStudioWorkspace();

  export let directives: readonly DirectiveBase[] = [];
  export let balancesByDate: Record<string, Record<string, number>> = {};
  export let balanceRoots: readonly string[] = [];
  export let focusedAccount: string | undefined = undefined;
  export let tableId = "journal-table";
  export let recordLabel = "journal";
  export let pageLabel = "Journal";
  export let amountHeading = "Amount";
  export let balanceDescription = "Shows the net worth balance for this date";
  export let emptyMessage =
    "No dated records match the current Journal filter.";
  export let linkAccounts = false;
  /** Review ledgers retain inspection but cannot be bulk-edited. */
  export let selectable = true;
  /** Controlled selection; parent may bind or listen via onSelectionChange. */
  export let selectedKeys = new Set<string>();
  export let onSelectionChange:
    | ((keys: Set<string>, records: JournalRecord[]) => void)
    | undefined = undefined;

  let expandedGroups = new Set<string>();
  let expandedPageSignature = "";
  let masterCheckbox: HTMLInputElement | undefined;
  let timeframe: JournalTimeframe = "transactions";
  let toggleValue: JournalTimeframe = "transactions";
  let merchantLogoMaps: JournalMerchantLogoMaps = {
    byId: new Map(),
    byNormalizedName: new Map(),
  };
  let failedLogoKeys = new Set<string>();
  let loadedMerchantProjectId = "";

  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
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

  function setTimeframe(value: string | undefined) {
    if (value !== "transactions" && value !== "upcoming") {
      toggleValue = timeframe;
      return;
    }
    const next: JournalTimeframe = value;
    toggleValue = next;
    if (next === timeframe) return;
    updateRoute({
      view: next === "upcoming" ? "upcoming" : undefined,
      page: "1",
      record: undefined,
    });
  }

  function commitSelection(next: Set<string>) {
    if (!selectable) return;
    selectedKeys = next;
    onSelectionChange?.(
      next,
      records.filter((record) => next.has(record.key)),
    );
  }

  function toggleRecord(key: string, checked?: boolean) {
    if (!selectable) return;
    const next = new Set(selectedKeys);
    const select = checked ?? !next.has(key);
    if (select) next.add(key);
    else next.delete(key);
    commitSelection(next);
  }

  function toggleGroup(group: JournalDateGroup, checked?: boolean) {
    if (!selectable) return;
    const keys = group.records.map((record) => record.key);
    const select = checked ?? !keys.every((key) => selectedKeys.has(key));
    const next = new Set(selectedKeys);
    keys.forEach((key) => (select ? next.add(key) : next.delete(key)));
    commitSelection(next);
  }

  function selectAllRecords() {
    if (!selectable) return;
    commitSelection(new Set(records.map((record) => record.key)));
  }

  function clearSelection() {
    if (!selectable) return;
    commitSelection(new Set());
  }

  function toggleVisible(checked?: boolean) {
    if (!selectable) return;
    const keys = visibleGroups.flatMap((group) =>
      group.records.map((record) => record.key),
    );
    const select = checked ?? !keys.every((key) => selectedKeys.has(key));
    if (!select && records.length > 0 && selectedKeys.size === records.length) {
      clearSelection();
      return;
    }
    const next = new Set(selectedKeys);
    keys.forEach((key) => (select ? next.add(key) : next.delete(key)));
    commitSelection(next);
  }

  function toggleSummary(groupKey: string) {
    const next = new Set(expandedGroups);
    if (next.has(groupKey)) next.delete(groupKey);
    else next.add(groupKey);
    expandedGroups = next;
  }

  function openRecord(record: JournalRecord) {
    updateRoute({ record: record.key });
  }

  function handleRecordKeydown(event: KeyboardEvent, record: JournalRecord) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openRecord(record);
    }
  }

  function stopRowClick(event: MouseEvent) {
    event.stopPropagation();
  }

  function stopRowKeydown(event: KeyboardEvent) {
    event.stopPropagation();
  }

  function balanceText(balance: Record<string, number>) {
    const entries = orderedBalanceEntries(balance, $operatingCurrency);
    return entries.length
      ? entries
          .map(([currency, amount]) => $ctx.money(amount, currency))
          .join(" · ")
      : "—";
  }

  function groupDate(group: JournalDateGroup) {
    return group.date.toFormat("LLLL dd, yyyy").toUpperCase();
  }

  function recordAmount(record: JournalRecord) {
    return postingAmountText(postingAmount(record));
  }

  function postingAmountText(amount: Amount | undefined) {
    return amount ? $ctx.money(amount, amount.currency ?? undefined) : "—";
  }

  function recordLogo(record: JournalRecord) {
    return resolveJournalMerchantLogo(record.directive, merchantLogoMaps);
  }

  function markLogoFailed(key: string) {
    if (failedLogoKeys.has(key)) return;
    failedLogoKeys = new Set(failedLogoKeys).add(key);
  }

  $: projectId = $snapshot?.project.id ?? "";
  $: if (!isWeb && projectId && projectId !== loadedMerchantProjectId) {
    loadedMerchantProjectId = projectId;
    void (async () => {
      try {
        const merchants = await ingestionJson<JournalMerchantLogo[]>(
          ingestionPath(projectId, "/merchants"),
        );
        merchantLogoMaps = buildJournalMerchantLogoMaps(
          Array.isArray(merchants) ? merchants : [],
        );
      } catch {
        merchantLogoMaps = { byId: new Map(), byNormalizedName: new Map() };
      }
    })();
  }

  $: timeframe =
    $activeRoute.query.view === "upcoming" ? "upcoming" : "transactions";
  $: toggleValue = timeframe;
  $: allRecords = journalRecords(directives, balanceRoots, focusedAccount);
  $: allGroups = groupJournalRecords(allRecords, balancesByDate);
  $: groups = filterJournalGroupsByTimeframe(
    allGroups,
    timeframe,
    DateTime.now(),
  );
  $: records = groups.flatMap((group) => group.records);
  $: shownEmptyMessage =
    timeframe === "upcoming"
      ? "No upcoming dated records match the current filter."
      : emptyMessage;
  $: validKeys = new Set(records.map((record) => record.key));
  $: if ([...selectedKeys].some((key) => !validKeys.has(key))) {
    commitSelection(
      new Set([...selectedKeys].filter((key) => validKeys.has(key))),
    );
  }
  $: pageSize = PAGE_SIZES.includes(Number($activeRoute.query.pageSize))
    ? Number($activeRoute.query.pageSize)
    : 50;
  $: pages = paginateJournalGroups(groups, pageSize);
  $: requestedPage = Math.max(1, Number($activeRoute.query.page) || 1);
  $: page = Math.min(requestedPage, Math.max(1, pages.length));
  $: visibleGroups = pages[page - 1] ?? [];
  $: visibleKeys = visibleGroups.flatMap((group) =>
    group.records.map((record) => record.key),
  );
  $: selectedVisibleCount = visibleKeys.filter((key) =>
    selectedKeys.has(key),
  ).length;
  $: masterChecked =
    Boolean(visibleKeys.length) && selectedVisibleCount === visibleKeys.length;
  $: masterIndeterminate = selectedVisibleCount > 0 && !masterChecked;
  $: hasOffPageRecords = records.length > visibleKeys.length;
  $: allMatchingSelected =
    records.length > 0 && selectedKeys.size === records.length;
  $: showSelectionBanner =
    hasOffPageRecords &&
    Boolean(visibleKeys.length) &&
    (masterChecked || allMatchingSelected);
  $: if (masterCheckbox) masterCheckbox.indeterminate = masterIndeterminate;
  $: pageSignature = visibleGroups.map((group) => group.key).join("|");
  $: if (pageSignature && pageSignature !== expandedPageSignature) {
    expandedPageSignature = pageSignature;
    expandedGroups = new Set([visibleGroups[0]!.key]);
  }
</script>

<section
  class="h-full overflow-y-auto p-3 sm:p-5"
  data-activity-table={tableId}
  data-journal-table={tableId === "journal-table" ? "" : undefined}
  data-account-activity-table={tableId === "account-activity-table"
    ? ""
    : undefined}
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4">
    <ToggleGroup.Root
      type="single"
      bind:value={toggleValue}
      aria-label="Activity timeframe"
      class="!gap-0 self-start rounded-lg bg-muted p-1"
      data-activity-timeframe-toggle
      onValueChange={setTimeframe}
    >
      <ToggleGroup.Item
        value="transactions"
        class="!h-7 !min-w-0 !px-6 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >Transactions</ToggleGroup.Item
      >
      <ToggleGroup.Item
        value="upcoming"
        class="!h-7 !min-w-0 !px-6 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
        >Upcoming</ToggleGroup.Item
      >
    </ToggleGroup.Root>

    <div
      class={selectable
        ? "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        : "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"}
    >
      {#if selectable}
        <input
          bind:this={masterCheckbox}
          use:setIndeterminate={masterIndeterminate}
          type="checkbox"
          class="size-4 rounded border-input text-primary focus:ring-ring"
          aria-label={`Select visible ${recordLabel} records`}
          checked={masterChecked}
          onchange={(event) =>
            toggleVisible((event.currentTarget as HTMLInputElement).checked)}
        />
      {/if}
      <span>Date</span>
      <span class="text-right">{amountHeading}</span>
    </div>

    {#if selectable && showSelectionBanner}
      <div
        data-activity-selection-banner
        role="status"
        class="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
      >
        {#if allMatchingSelected}
          All {records.length}
          {recordLabel} records selected.
          <button
            type="button"
            class="font-medium text-primary underline-offset-2 hover:underline"
            onclick={clearSelection}
          >
            Clear selection
          </button>
        {:else}
          All {visibleKeys.length} records on this page are selected.
          <button
            type="button"
            class="font-medium text-primary underline-offset-2 hover:underline"
            onclick={selectAllRecords}
          >
            Select all {records.length}
            {recordLabel} records
          </button>
        {/if}
      </div>
    {/if}

    {#if !groups.length}
      <div
        class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
      >
        {shownEmptyMessage}
      </div>
    {/if}

    {#each visibleGroups as group}
      {@const groupKeys = group.records.map((record) => record.key)}
      {@const groupSelected = groupKeys.filter((key) =>
        selectedKeys.has(key),
      ).length}
      {@const groupChecked = groupSelected === groupKeys.length}
      {@const groupIndeterminate = groupSelected > 0 && !groupChecked}
      {@const expanded = expandedGroups.has(group.key)}
      {@const groupId = `${tableId}-group-${group.key}`}
      {@const summaryId = `${tableId}-summary-${group.key}`}
      <section
        class="overflow-hidden rounded-2xl bg-muted/80"
        aria-labelledby={groupId}
      >
        <div
          class={selectable
            ? "grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4"
            : "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4"}
        >
          {#if selectable}
            <input
              use:setIndeterminate={groupIndeterminate}
              type="checkbox"
              class="size-4 rounded border-input text-primary focus:ring-ring"
              aria-label={`Select all ${group.records.length} records from ${groupDate(group)}`}
              checked={groupChecked}
              onchange={(event) =>
                toggleGroup(
                  group,
                  (event.currentTarget as HTMLInputElement).checked,
                )}
            />
          {/if}
          <button
            type="button"
            class="flex min-w-0 items-center justify-between gap-3 rounded-md text-left outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            data-activity-group-toggle
            data-journal-group-toggle={tableId === "journal-table"
              ? ""
              : undefined}
            aria-expanded={expanded}
            aria-controls={summaryId}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${groupDate(group)}`}
            onclick={() => toggleSummary(group.key)}
          >
            <span
              id={groupId}
              role="heading"
              aria-level="2"
              class="truncate text-sm font-semibold tracking-wide text-foreground"
            >
              {groupDate(group)}
              <span class="ml-2 text-muted-foreground"
                >· {group.records.length}</span
              >
            </span>
            <span
              class="hidden max-w-[16rem] shrink-0 truncate text-right text-sm font-semibold tabular-nums sm:block"
              title={balanceText(group.balance.final)}
            >
              {balanceText(group.balance.final)}
            </span>
          </button>
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            title={balanceDescription}
            aria-label="About this date's balance"
          >
            <Info class="size-4" />
          </button>
          <button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-expanded={expanded}
            aria-controls={summaryId}
            aria-label={`${expanded ? "Hide" : "Show"} balance summary for ${groupDate(group)}`}
            onclick={() => toggleSummary(group.key)}
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
            class="grid gap-2 border-t border-dashed px-5 py-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
          >
            <span>Start balance</span>
            <span class="hidden border-t border-dashed sm:block"></span>
            <span class="text-right font-semibold tabular-nums"
              >{balanceText(group.balance.start)}</span
            >
            <span>Net cash flow</span>
            <span class="hidden border-t border-dashed sm:block"></span>
            <span class="text-right font-semibold tabular-nums"
              >{balanceText(group.balance.change)}</span
            >
            <span>Final balance</span>
            <span class="hidden border-t border-dashed sm:block"></span>
            <span class="text-right font-bold tabular-nums"
              >{balanceText(group.balance.final)}</span
            >
          </div>
        {/if}

        <div
          class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          {#each group.records as record, index}
            {@const logo = recordLogo(record)}
            <div
              role="button"
              tabindex="0"
              class:rounded-b-xl={index === group.records.length - 1}
              class={selectable
                ? "grid cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_minmax(14rem,22rem)] items-center gap-3 border-b px-[15px] py-4 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                : "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_minmax(14rem,22rem)] items-center gap-3 border-b px-[15px] py-4 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"}
              aria-label={`Open ${record.title}`}
              onclick={() => openRecord(record)}
              onkeydown={(event) => handleRecordKeydown(event, record)}
            >
              {#if selectable}
                <input
                  type="checkbox"
                  class="size-4 rounded border-input text-primary focus:ring-ring"
                  aria-label={`Select ${record.title}`}
                  checked={selectedKeys.has(record.key)}
                  onclick={(event) => event.stopPropagation()}
                  onchange={(event) =>
                    toggleRecord(
                      record.key,
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
              {/if}
              {#if logo && !failedLogoKeys.has(record.key)}
                <img
                  class="size-10 rounded-full border object-contain"
                  src={logo}
                  alt=""
                  onerror={() => markLogoFailed(record.key)}
                />
              {:else}
                <div
                  class="flex size-10 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground"
                  aria-hidden="true"
                >
                  {#if record.directive.constructor.name === "Transaction"}
                    {record.title.slice(0, 1).toUpperCase()}
                  {:else}
                    <FileText class="size-4" />
                  {/if}
                </div>
              {/if}
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold">{record.title}</div>
                <div class="mt-1 truncate text-xs text-muted-foreground">
                  {record.detail}
                </div>
              </div>
              <div class="flex min-w-0 flex-col gap-1 text-right">
                {#if record.postings?.length}
                  {#each record.postings as posting}
                    <div
                      class="grid min-w-0 grid-cols-[minmax(0,1fr)_8rem] items-center gap-3"
                      data-activity-posting
                      data-journal-posting={tableId === "journal-table"
                        ? ""
                        : undefined}
                      data-account-posting={tableId === "account-activity-table"
                        ? ""
                        : undefined}
                    >
                      {#if linkAccounts}
                        <a
                          class="truncate text-left text-xs text-muted-foreground hover:text-primary hover:underline"
                          href={urlForAccount(posting.account)}
                          onclick={stopRowClick}
                          onkeydown={stopRowKeydown}
                          title={posting.account}>{posting.account}</a
                        >
                      {:else}
                        <span
                          class="truncate text-left text-xs text-muted-foreground"
                          title={posting.account}>{posting.account}</span
                        >
                      {/if}
                      <span class="text-sm font-semibold tabular-nums"
                        >{postingAmountText(posting.amount)}</span
                      >
                    </div>
                  {/each}
                {:else}
                  <span
                    class="self-end rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground"
                    >{record.type}</span
                  >
                  {#if record.posting}
                    <span class="text-sm font-semibold tabular-nums"
                      >{recordAmount(record)}</span
                    >
                  {/if}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    {#if pages.length > 1}
      <nav
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
        aria-label={`${pageLabel} pages`}
      >
        <span class="text-sm text-muted-foreground"
          >Page {page} of {pages.length}</span
        >
        <div class="flex items-center gap-2">
          <div class="hidden items-center gap-2 sm:flex">
            <label
              class="text-sm text-muted-foreground"
              for={`${tableId}-page-size`}>Records per page</label
            >
            <select
              id={`${tableId}-page-size`}
              class="h-8 rounded-md border bg-background px-2 text-sm"
              value={pageSize}
              onchange={(event) =>
                updateRoute({
                  pageSize: (event.currentTarget as HTMLSelectElement).value,
                  page: "1",
                })}
            >
              {#each PAGE_SIZES as size}
                <option value={size}>{size}</option>
              {/each}
            </select>
          </div>
          <Button
            size="icon"
            variant="outline"
            aria-label={`Previous ${pageLabel} page`}
            disabled={page <= 1}
            onclick={() => updateRoute({ page: String(page - 1) })}
          >
            <ChevronsLeft />
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label={`Next ${pageLabel} page`}
            disabled={page >= pages.length}
            onclick={() => updateRoute({ page: String(page + 1) })}
          >
            <ChevronsRight />
          </Button>
        </div>
      </nav>
    {/if}
  </div>
</section>
