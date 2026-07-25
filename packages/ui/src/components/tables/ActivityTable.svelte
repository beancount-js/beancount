<script lang="ts">
  import ChevronDown from "lucide-svelte/icons/chevron-down";
  import ChevronUp from "lucide-svelte/icons/chevron-up";
  import FileText from "lucide-svelte/icons/file-text";
  import Info from "lucide-svelte/icons/info";
  import * as Select from "../shadcn/select";
  import * as ToggleGroup from "../shadcn/toggle-group";
  import PagePagination from "../navigation/PagePagination.svelte";

  export type ActivityPosting = {
    account: string;
    amount: string;
    href?: string;
  };

  export type ActivityRecord = {
    id: string;
    title: string;
    detail: string;
    type: string;
    amount: string;
    logoUrl?: string;
    logoFallback?: string;
    /** Optional fixed list of posting rows for the amount section. */
    postings?: readonly ActivityPosting[];
  };

  export type ActivityGroup = {
    id: string;
    date: string;
    records: readonly ActivityRecord[];
    balance?: string;
    summary?: {
      start: string;
      change: string;
      final: string;
    };
  };

  export type ActivityTimeframe = {
    id: string;
    label: string;
  };

  let {
    groups,
    selectedIds = [],
    selectable = true,
    tableId = "journal-table",
    recordLabel = "journal",
    pageLabel = "Journal",
    amountHeading = "Amount",
    balanceDescription = "Shows the net worth balance for this date",
    emptyMessage = "No dated records match the current filter.",
    timeframes = [
      { id: "transactions", label: "Transactions" },
      { id: "upcoming", label: "Upcoming" },
    ],
    timeframe = "transactions",
    pageSizeOptions = [25, 50, 100],
    page = 1,
    pageSize = 50,
    onTimeframeChange = () => {},
    onPageChange = () => {},
    onPageSizeChange = () => {},
    onSelectedIdsChange = () => {},
    onOpenRecord,
    rowActionLabel = "Edit",
  }: {
    groups: readonly ActivityGroup[];
    selectedIds?: readonly string[];
    selectable?: boolean;
    tableId?: string;
    recordLabel?: string;
    pageLabel?: string;
    amountHeading?: string;
    balanceDescription?: string;
    emptyMessage?: string;
    timeframes?: readonly ActivityTimeframe[];
    timeframe?: string;
    pageSizeOptions?: readonly number[];
    page?: number;
    pageSize?: number;
    onTimeframeChange?: (timeframe: string) => void;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    onSelectedIdsChange?: (ids: string[]) => void;
    onOpenRecord?: (record: ActivityRecord) => void;
    /** Label prefix for each row action button. */
    rowActionLabel?: string;
  } = $props();

  const PAGE_SIZES = [25, 50, 100];

  let expandedGroups = $state(new Set<string>());
  let failedLogoKeys = $state(new Set<string>());
  let masterCheckbox = $state<HTMLInputElement | undefined>();
  let expandedPageSignature = $state("");

  const selectedIdSet = $derived(new Set(selectedIds));
  const isJournalTable = $derived(tableId === "journal-table");
  const isAccountActivityTable = $derived(
    tableId === "account-activity-table",
  );
  const effectivePageSizes = $derived(
    pageSizeOptions.length ? [...pageSizeOptions] : PAGE_SIZES,
  );

  const allRecords = $derived(groups.flatMap((group) => group.records));
  const allRecordIds = $derived(allRecords.map((record) => record.id));
  const effectivePageSize = $derived(
    effectivePageSizes.includes(pageSize) ? pageSize : effectivePageSizes[0] ?? 50,
  );
  const pageSizes = $derived.by(() => {
    const sizes = [...effectivePageSizes];
    if (!sizes.includes(effectivePageSize)) {
      sizes.push(effectivePageSize);
      sizes.sort((left, right) => left - right);
    }
    return sizes;
  });
  const pages = $derived(
    (() => {
      const pageLimit = Math.max(1, effectivePageSize);
      const grouped: ActivityGroup[][] = [];
      let current: ActivityGroup[] = [];
      let count = 0;
      for (const group of groups) {
        if (current.length && count + group.records.length > pageLimit) {
          grouped.push(current);
          current = [];
          count = 0;
        }
        current.push(group);
        count += group.records.length;
      }
      if (current.length) grouped.push(current);
      return grouped;
    })(),
  );
  const maxPage = $derived(Math.max(1, pages.length));
  const normalizedPage = $derived(Math.min(Math.max(page, 1), maxPage));
  const visibleGroups = $derived(pages[normalizedPage - 1] ?? []);
  const visibleKeys = $derived(
    visibleGroups.flatMap((group) => group.records.map((record) => record.id)),
  );
  const selectedVisibleCount = $derived(
    visibleKeys.filter((id) => selectedIdSet.has(id)).length,
  );
  const masterChecked = $derived(
    Boolean(visibleKeys.length) && selectedVisibleCount === visibleKeys.length,
  );
  const masterIndeterminate = $derived(
    selectedVisibleCount > 0 && !masterChecked,
  );
  const hasOffPageRecords = $derived(
    allRecordIds.length > visibleKeys.length,
  );
  const allMatchingSelected = $derived(
    allRecordIds.length > 0 && selectedIds.length === allRecordIds.length,
  );
  const showSelectionBanner = $derived(
    hasOffPageRecords &&
      Boolean(visibleKeys.length) &&
      (masterChecked || allMatchingSelected),
  );

  $effect(() => {
    const signature = visibleGroups.map((group) => group.id).join("|");
    if (signature && signature !== expandedPageSignature) {
      expandedPageSignature = signature;
      expandedGroups = new Set(visibleGroups.map((group) => group.id));
    }
    if (masterCheckbox) {
      masterCheckbox.indeterminate = masterIndeterminate;
    }
  });

  function commitSelection(next: Set<string>) {
    onSelectedIdsChange([...new Set(next)]);
  }

  function toggleRecord(key: string, checked: boolean) {
    if (!selectable) return;
    const next = new Set(selectedIds);
    if (checked) next.add(key);
    else next.delete(key);
    commitSelection(next);
  }

  function toggleGroup(group: ActivityGroup, checked: boolean) {
    if (!selectable) return;
    const next = new Set(selectedIds);
    for (const record of group.records) {
      if (checked) next.add(record.id);
      else next.delete(record.id);
    }
    commitSelection(next);
  }

  function toggleVisible(checked: boolean) {
    if (!selectable) return;
    const next = new Set(selectedIds);
    const visible = new Set(visibleKeys);
    if (checked) {
      for (const key of visible) next.add(key);
    } else {
      for (const key of visible) next.delete(key);
    }
    commitSelection(next);
  }

  function toggleSummary(groupId: string) {
    const next = new Set(expandedGroups);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    expandedGroups = next;
  }

  function clearSelection() {
    commitSelection(new Set());
  }

  function selectAllRecords() {
    commitSelection(new Set(allRecordIds));
  }

  function changeTimeframe(next: string | undefined) {
    if (!next) return;
    onTimeframeChange(next);
  }

  function changePage(next: number) {
    onPageChange(next);
  }

  function changePageSize(next: number) {
    if (!effectivePageSizes.includes(next) && !pageSizes.includes(next)) return;
    onPageSizeChange(next);
  }

  function setLogoFailed(recordId: string) {
    failedLogoKeys = new Set(failedLogoKeys).add(recordId);
  }

  function openRecord(record: ActivityRecord) {
    onOpenRecord?.(record);
  }
  function setIndeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(next: boolean) {
        node.indeterminate = next;
      },
    };
  }
</script>

<section
  class="h-full overflow-y-auto p-3 sm:p-5"
  data-activity-table={tableId}
  data-journal-table={isJournalTable ? "" : undefined}
  data-account-activity-table={
    isAccountActivityTable ? "" : undefined
  }
>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4">
    <ToggleGroup.Root
      type="single"
      value={timeframe}
      aria-label="Activity timeframe"
      class="!gap-0 self-start rounded-lg bg-muted p-1"
      data-activity-timeframe-toggle
      onValueChange={changeTimeframe}
    >
      {#each timeframes as option}
        <ToggleGroup.Item
          value={option.id}
          class="!h-7 !min-w-0 !px-6 text-muted-foreground hover:bg-accent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >{option.label}</ToggleGroup.Item
        >
      {/each}
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
        role="status"
        class="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
      >
        {#if allMatchingSelected}
          All {allRecordIds.length}
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
            Select all {allRecordIds.length}
            {recordLabel} records
          </button>
        {/if}
      </div>
    {/if}

    {#if !groups.length}
      <div
        class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
      >
        {emptyMessage}
      </div>
    {/if}

    {#each visibleGroups as group (group.id)}
      {@const groupKeys = group.records.map((record) => record.id)}
      {@const selectedCount = groupKeys.filter((key) => selectedIdSet.has(key)).length}
      {@const groupChecked = groupKeys.length > 0 && selectedCount === groupKeys.length}
      {@const groupIndeterminate =
        selectedCount > 0 && selectedCount < groupKeys.length}
      {@const expanded = expandedGroups.has(group.id)}
      {@const groupId = `${tableId}-group-${group.id}`}
      {@const summaryId = `${tableId}-summary-${group.id}`}
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
              aria-label={`Select all ${group.records.length} records from ${group.date}`}
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
            aria-expanded={expanded}
            aria-controls={summaryId}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${group.date}`}
            onclick={() => toggleSummary(group.id)}
          >
            <span
              id={groupId}
              role="heading"
              aria-level="2"
              class="truncate text-sm font-semibold tracking-wide text-foreground"
            >
              {group.date}
              <span class="ml-2 text-muted-foreground"
                >· {group.records.length}</span
              >
            </span>
            <span
              class="hidden max-w-[16rem] shrink-0 truncate text-right text-sm font-semibold tabular-nums sm:block"
              title={group.summary?.final ?? group.balance ?? "—"}
            >
              {group.summary?.final ?? group.balance ?? "—"}
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
            aria-label={`${expanded ? "Hide" : "Show"} balance summary for ${group.date}`}
            onclick={() => toggleSummary(group.id)}
          >
            {#if expanded}
              <ChevronUp class="size-4" />
            {:else}
              <ChevronDown class="size-4" />
            {/if}
          </button>
        </div>

        {#if expanded && group.summary}
          <div
            id={summaryId}
            class="grid gap-2 border-t border-dashed px-5 py-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
          >
            <span>Start balance</span>
            <span class="hidden border-t border-dashed sm:block"></span>
            <span class="text-right font-semibold tabular-nums"
              >{group.summary.start}</span
            >
            <span>Net cash flow</span>
            <span class="hidden border-t border-dashed sm:block"></span>
            <span class="text-right font-semibold tabular-nums"
              >{group.summary.change}</span
            >
            <span>Final balance</span>
            <span class="hidden border-t border-dashed sm:block"></span>
            <span class="text-right font-bold tabular-nums"
              >{group.summary.final}</span
            >
          </div>
        {/if}

        <div
          class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          {#each group.records as record, index (record.id)}
            {@const logo = record.logoUrl}
            <div
              class:rounded-b-xl={index === group.records.length - 1}
              class={selectable
                ? "grid grid-cols-[auto_auto_minmax(0,1fr)_minmax(14rem,22rem)] items-center gap-3 border-b px-[15px] py-4 transition-colors last:border-b-0 hover:bg-accent/60"
                : "grid grid-cols-[auto_minmax(0,1fr)_minmax(14rem,22rem)] items-center gap-3 border-b px-[15px] py-4 transition-colors last:border-b-0 hover:bg-accent/60"}
            >
              {#if selectable}
                <input
                  type="checkbox"
                  class="size-4 rounded border-input text-primary focus:ring-ring"
                  aria-label={`Select ${record.title}`}
                  checked={selectedIdSet.has(record.id)}
                  onclick={(event) => event.stopPropagation()}
                  onchange={(event) =>
                    toggleRecord(
                      record.id,
                      (event.currentTarget as HTMLInputElement).checked,
                    )}
                />
              {/if}
              {#if logo && !failedLogoKeys.has(record.id)}
                <img
                  class="size-10 rounded-full border object-contain"
                  src={logo}
                  alt=""
                  onerror={() => setLogoFailed(record.id)}
                />
              {:else}
                <div
                  class="flex size-10 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground"
                  aria-hidden="true"
                >
                  {#if record.logoFallback}
                    {record.logoFallback.slice(0, 1).toUpperCase()}
                  {:else}
                    <FileText class="size-4" />
                  {/if}
                </div>
              {/if}
              <button
                type="button"
                class="min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${rowActionLabel} ${record.title}`}
                onclick={() => openRecord(record)}
              >
                <div class="truncate text-sm font-semibold">{record.title}</div>
                <div class="mt-1 truncate text-xs text-muted-foreground">
                  {record.detail}
                </div>
              </button>
              <div class="flex min-w-0 flex-col gap-1 text-right">
                {#if record.postings?.length}
                  {#each record.postings as posting}
                    <div
                      class="grid min-w-0 grid-cols-[minmax(0,1fr)_8rem] items-center gap-3"
                      data-activity-posting
                      data-journal-posting={isJournalTable ? "" : undefined}
                      data-account-posting={
                        isAccountActivityTable ? "" : undefined
                      }
                    >
                      {#if posting.href}
                        <span class="block min-w-0 text-left text-xs">
                          <a
                            href={posting.href}
                            class="block truncate text-primary underline-offset-4 hover:underline"
                            >{posting.account}</a
                          >
                        </span>
                      {:else}
                        <span
                          class="truncate text-left text-xs text-muted-foreground"
                          title={posting.account}>{posting.account}</span
                        >
                      {/if}
                      <span class="text-sm font-semibold tabular-nums"
                        >{posting.amount}</span
                      >
                    </div>
                  {/each}
                {:else}
                  <span
                    class="self-end rounded-full border px-2 py-0.5 text-xs capitalize text-muted-foreground"
                    >{record.type}</span
                  >
                  {#if record.amount}
                    <span class="text-sm font-semibold tabular-nums">{record.amount}</span>
                  {/if}
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}

    {#if pages.length > 1}
      <div
        class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <span class="text-sm text-muted-foreground">
          {normalizedPage} of {pages.length}
        </span>
        <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div class="hidden items-center gap-2 sm:flex">
            <span
              class="text-sm text-muted-foreground"
              id={`${tableId}-page-size-label`}
              >Page size</span
            >
            <Select.Root
              type="single"
              value={String(effectivePageSize)}
              onValueChange={changePageSize}
            >
              <Select.Trigger
                id={`${tableId}-page-size`}
                aria-labelledby={`${tableId}-page-size-label`}
                class="h-8 w-20 font-mono text-sm tabular-nums"
              >
                {effectivePageSize}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  {#each effectivePageSizes as size}
                    <Select.Item value={String(size)} label={`${size} records`}>
                      {size}
                    </Select.Item>
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>
          <PagePagination
            page={normalizedPage}
            pageCount={pages.length}
            ariaLabel={`${pageLabel} pages`}
            onPageChange={changePage}
          />
        </div>
      </div>
    {/if}
  </div>
</section>
