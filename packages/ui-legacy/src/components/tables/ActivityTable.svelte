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
  const isAccountActivityTable = $derived(tableId === "account-activity-table");
  const effectivePageSizes = $derived(
    pageSizeOptions.length ? [...pageSizeOptions] : PAGE_SIZES,
  );

  const allRecords = $derived(groups.flatMap((group) => group.records));
  const allRecordIds = $derived(allRecords.map((record) => record.id));
  const effectivePageSize = $derived(
    effectivePageSizes.includes(pageSize)
      ? pageSize
      : (effectivePageSizes[0] ?? 50),
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
  const hasOffPageRecords = $derived(allRecordIds.length > visibleKeys.length);
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
  class="cn-tables-activitytable-260-1"
  data-activity-table={tableId}
  data-journal-table={isJournalTable ? "" : undefined}
  data-account-activity-table={isAccountActivityTable ? "" : undefined}
>
  <div class="cn-tables-activitytable-267-1">
    <ToggleGroup.Root
      type="single"
      value={timeframe}
      aria-label="Activity timeframe"
      class="cn-tables-activitytable-272-1"
      data-activity-timeframe-toggle
      onValueChange={changeTimeframe}
    >
      {#each timeframes as option}
        <ToggleGroup.Item
          value={option.id}
          class="cn-tables-activitytable-279-1">{option.label}</ToggleGroup.Item
        >
      {/each}
    </ToggleGroup.Root>

    <div
      class={selectable
        ? "cn-tables-activitytable-287-1"
        : "cn-tables-activitytable-288-1"}
    >
      {#if selectable}
        <input
          bind:this={masterCheckbox}
          use:setIndeterminate={masterIndeterminate}
          type="checkbox"
          class="cn-tables-activitytable-295-1"
          aria-label={`Select visible ${recordLabel} records`}
          checked={masterChecked}
          onchange={(event) =>
            toggleVisible((event.currentTarget as HTMLInputElement).checked)}
        />
      {/if}
      <span>Date</span>
      <span class="cn-tables-activitytable-303-1">{amountHeading}</span>
    </div>

    {#if selectable && showSelectionBanner}
      <div role="status" class="cn-tables-activitytable-309-1">
        {#if allMatchingSelected}
          All {allRecordIds.length}
          {recordLabel} records selected.
          <button
            type="button"
            class="cn-tables-activitytable-316-1"
            onclick={clearSelection}
          >
            Clear selection
          </button>
        {:else}
          All {visibleKeys.length} records on this page are selected.
          <button
            type="button"
            class="cn-tables-activitytable-325-1"
            onclick={selectAllRecords}
          >
            Select all {allRecordIds.length}
            {recordLabel} records
          </button>
        {/if}
      </div>
    {/if}

    {#if !groups.length}
      <div class="cn-tables-activitytable-337-1">
        {emptyMessage}
      </div>
    {/if}

    {#each visibleGroups as group (group.id)}
      {@const groupKeys = group.records.map((record) => record.id)}
      {@const selectedCount = groupKeys.filter((key) =>
        selectedIdSet.has(key),
      ).length}
      {@const groupChecked =
        groupKeys.length > 0 && selectedCount === groupKeys.length}
      {@const groupIndeterminate =
        selectedCount > 0 && selectedCount < groupKeys.length}
      {@const expanded = expandedGroups.has(group.id)}
      {@const groupId = `${tableId}-group-${group.id}`}
      {@const summaryId = `${tableId}-summary-${group.id}`}
      <section class="cn-tables-activitytable-353-1" aria-labelledby={groupId}>
        <div
          class={selectable
            ? "cn-tables-activitytable-358-1"
            : "cn-tables-activitytable-359-1"}
        >
          {#if selectable}
            <input
              use:setIndeterminate={groupIndeterminate}
              type="checkbox"
              class="cn-tables-activitytable-365-1"
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
            class="cn-tables-activitytable-377-1"
            data-activity-group-toggle
            aria-expanded={expanded}
            aria-controls={expanded && group.summary ? summaryId : undefined}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${group.date}`}
            onclick={() => toggleSummary(group.id)}
          >
            <span
              id={groupId}
              role="heading"
              aria-level="2"
              class="cn-tables-activitytable-388-1"
            >
              {group.date}
              <span class="cn-tables-activitytable-391-1"
                >· {group.records.length}</span
              >
            </span>
            <span
              class="cn-tables-activitytable-396-1"
              title={group.summary?.final ?? group.balance ?? "—"}
            >
              {group.summary?.final ?? group.balance ?? "—"}
            </span>
          </button>
          <button
            type="button"
            class="cn-tables-activitytable-404-1"
            title={balanceDescription}
            aria-label="About this date's balance"
          >
            <Info class="cn-tables-activitytable-408-1" />
          </button>
          <button
            type="button"
            class="cn-tables-activitytable-412-1"
            aria-expanded={expanded}
            aria-controls={expanded && group.summary ? summaryId : undefined}
            aria-label={`${expanded ? "Hide" : "Show"} balance summary for ${group.date}`}
            onclick={() => toggleSummary(group.id)}
          >
            {#if expanded}
              <ChevronUp class="cn-tables-activitytable-419-1" />
            {:else}
              <ChevronDown class="cn-tables-activitytable-421-1" />
            {/if}
          </button>
        </div>

        {#if expanded && group.summary}
          <div id={summaryId} class="cn-tables-activitytable-429-1">
            <span>Start balance</span>
            <span class="cn-tables-activitytable-432-1"></span>
            <span class="cn-tables-activitytable-433-1"
              >{group.summary.start}</span
            >
            <span>Net cash flow</span>
            <span class="cn-tables-activitytable-437-1"></span>
            <span class="cn-tables-activitytable-438-1"
              >{group.summary.change}</span
            >
            <span>Final balance</span>
            <span class="cn-tables-activitytable-442-1"></span>
            <span class="cn-tables-activitytable-443-1"
              >{group.summary.final}</span
            >
          </div>
        {/if}

        <div class="cn-tables-activitytable-450-1">
          {#each group.records as record, index (record.id)}
            {@const logo = record.logoUrl}
            <div
              class:cn-tables-activitytable-455-1={index ===
                group.records.length - 1}
              class={selectable
                ? "cn-tables-activitytable-457-1"
                : "cn-tables-activitytable-458-1"}
            >
              {#if selectable}
                <input
                  type="checkbox"
                  class="cn-tables-activitytable-463-1"
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
                  class="cn-tables-activitytable-476-1"
                  src={logo}
                  alt=""
                  onerror={() => setLogoFailed(record.id)}
                />
              {:else}
                <div class="cn-tables-activitytable-483-1" aria-hidden="true">
                  {#if record.logoFallback}
                    {record.logoFallback.slice(0, 1).toUpperCase()}
                  {:else}
                    <FileText class="cn-tables-activitytable-489-1" />
                  {/if}
                </div>
              {/if}
              <button
                type="button"
                class="cn-tables-activitytable-495-1"
                aria-label={`${rowActionLabel} ${record.title}`}
                onclick={() => openRecord(record)}
              >
                <div class="cn-tables-activitytable-499-1">{record.title}</div>
                <div class="cn-tables-activitytable-500-1">
                  {record.detail}
                </div>
              </button>
              <div class="cn-tables-activitytable-504-1">
                {#if record.postings?.length}
                  {#each record.postings as posting}
                    <div
                      class="cn-tables-activitytable-508-1"
                      data-activity-posting
                      data-journal-posting={isJournalTable ? "" : undefined}
                      data-account-posting={isAccountActivityTable
                        ? ""
                        : undefined}
                    >
                      {#if posting.href}
                        <span class="cn-tables-activitytable-516-1">
                          <a
                            href={posting.href}
                            class="cn-tables-activitytable-519-1"
                            >{posting.account}</a
                          >
                        </span>
                      {:else}
                        <span
                          class="cn-tables-activitytable-525-1"
                          title={posting.account}>{posting.account}</span
                        >
                      {/if}
                      <span class="cn-tables-activitytable-529-1"
                        >{posting.amount}</span
                      >
                    </div>
                  {/each}
                {:else}
                  <span class="cn-tables-activitytable-536-1"
                    >{record.type}</span
                  >
                  {#if record.amount}
                    <span class="cn-tables-activitytable-540-1"
                      >{record.amount}</span
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
      <div class="cn-tables-activitytable-552-1">
        <span class="cn-tables-activitytable-554-1">
          {normalizedPage} of {pages.length}
        </span>
        <div class="cn-tables-activitytable-557-1">
          <div class="cn-tables-activitytable-558-1">
            <span
              class="cn-tables-activitytable-560-1"
              id={`${tableId}-page-size-label`}>Page size</span
            >
            <Select.Root
              type="single"
              value={String(effectivePageSize)}
              onValueChange={changePageSize}
            >
              <Select.Trigger
                id={`${tableId}-page-size`}
                aria-labelledby={`${tableId}-page-size-label`}
                class="cn-tables-activitytable-572-1"
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
