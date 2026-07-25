<script lang="ts">
  import {
    Balance,
    Close,
    Open,
    Pad,
    Transaction,
    type Amount,
    type DirectiveBase,
  } from "@beancount-js/beancount";
  import { AccountFilter } from "@beancount-js/filters";
  import { onDestroy } from "svelte";
  import { DateTime } from "luxon";
  import { useContext } from "../context";
  import { useCtx } from "../stores/format";
  import { urlForAccount } from "../helpers";
  import { useNavigation } from "../router/router";
  import * as Select from "$lib/components/ui/select";
  import * as ToggleGroup from "$lib/components/ui/toggle-group";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import { useLedger } from "./helpers";
  import PagePagination from "./PagePagination.svelte";
  import AccountActivityTable from "@beancount-js/ui/tables/AccountActivityTable.svelte";
  import AccountBulkActionSheet from "./AccountBulkActionSheet.svelte";
  import {
    filterJournalGroupsByTimeframe,
    groupJournalRecords,
    journalRecords,
    orderedBalanceEntries,
    paginateJournalGroups,
    postingAmount,
    type JournalRecord,
    type JournalTimeframe,
    type JournalDateGroup,
  } from "./journal-table/model";

  export let account: string;

  const PAGE_SIZES = [25, 50, 100];

  const { conversion, operatingCurrency } = useContext();
  const { activeLedgerKind } = useStudioWorkspace();
  const { activeRoute, router } = useNavigation();
  const ctx = useCtx();

  let page = 1;
  let selectedKeys = new Set<string>();
  let selectedRecords: JournalRecord[] = [];
  let selectedRecordIds: string[] = [];
  let recordMap = new Map<string, JournalRecord>();
  let bulkSheetOpen = false;
  let groupsForTable: {
    id: string;
    date: string;
    records: {
      id: string;
      description: string;
      detail: string;
      amount: string;
      postings?: {
        account: string;
        amount: string;
        href?: string;
      }[];
    }[];
    balance?: string;
    summary?: {
      start: string;
      change: string;
      final: string;
    };
  }[] = [];

  $: ledgerData = useLedger(AccountFilter.of(account));
  $: directives = $ledgerData.directives.filter(
    (directive) =>
      directive instanceof Transaction ||
      directive instanceof Pad ||
      directive instanceof Balance ||
      directive instanceof Open ||
      directive instanceof Close,
  ) as readonly DirectiveBase[];
  $: balancesByDate = $ledgerData.accountBalanceByDate($conversion, account);
  let timeframe: JournalTimeframe = "transactions";
  $: timeframe =
    $activeRoute.query.view === "upcoming" ? "upcoming" : "transactions";
  $: allRecords = journalRecords(directives, undefined, account);
  $: allGroups = groupJournalRecords(allRecords, balancesByDate);
  $: groups = filterJournalGroupsByTimeframe(
    allGroups,
    timeframe,
    DateTime.now(),
  );
  $: pageSize = PAGE_SIZES.includes(Number($activeRoute.query.pageSize))
    ? Number($activeRoute.query.pageSize)
    : 50;
  $: recordMap = new Map(allRecords.map((record) => [record.key, record]));
  $: pages = paginateJournalGroups(groups, pageSize);
  $: requestedPage = Math.max(1, Number($activeRoute.query.page) || 1);
  $: page = Math.min(requestedPage, Math.max(1, pages.length));
  $: visibleGroups = pages[page - 1] ?? [];
  $: visibleRecords = visibleGroups.flatMap((group) => group.records);
  $: visibleKeys = visibleRecords.map((record) => record.key);
  $: selectedVisibleCount = visibleKeys.filter((key) => selectedKeys.has(key)).length;
  $: masterChecked = Boolean(visibleKeys.length) && selectedVisibleCount === visibleKeys.length;
  $: hasOffPageRecords = allRecords.length > visibleKeys.length;
  $: allMatchingSelected =
    allRecords.length > 0 && selectedKeys.size === allRecords.length;
  $: showSelectionBanner =
    hasOffPageRecords &&
    Boolean(visibleKeys.length) &&
    (masterChecked || allMatchingSelected);
  $: emptyMessage =
    timeframe === "upcoming"
      ? "No upcoming dated records match the current filter."
      : "No dated records match the current account filter.";
  $: selectedRecordIds = [...selectedKeys];
  $: groupsForTable = visibleGroups.map(toUiGroup);

  $: if ([...selectedKeys].some((key) => !recordMap.has(key))) {
    commitSelection(new Set([...selectedKeys].filter((key) => recordMap.has(key))));
  }

  $: readOnly = $activeLedgerKind === "ingestion-review";
  $: {
    if (readOnly) {
      ingestionHeaderActions.set(null);
    } else {
      ingestionHeaderActions.set({
        kind: "account-activity",
        selectedCount: selectedKeys.size,
        onReplace: () => {
          bulkSheetOpen = true;
        },
      });
    }
  }


  onDestroy(() => ingestionHeaderActions.set(null));

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
    if (value !== "transactions" && value !== "upcoming") return;
    updateRoute({
      view: value === "upcoming" ? "upcoming" : undefined,
      page: "1",
      record: undefined,
    });
  }

  function amountText(amount?: Amount) {
    return amount ? $ctx.money(amount, amount.currency ?? undefined) : "—";
  }

  function balanceText(balance: Record<string, number>) {
    const entries = orderedBalanceEntries(balance, $operatingCurrency);
    return entries.length
      ? entries.map(([currency, value]) => $ctx.money(value, currency)).join(" · ")
      : "—";
  }

  function groupDate(group: JournalDateGroup) {
    return group.date.toFormat("LLLL dd, yyyy").toUpperCase();
  }

  function toUiRecord(record: JournalRecord) {
    const postings = record.postings
      ?.filter((posting) => posting.account)
      .map((posting) => ({
        account: posting.account,
        amount: amountText(posting.amount),
        href: posting.account ? urlForAccount(posting.account) : undefined,
      }));

    return {
      id: record.key,
      description: record.title,
      detail: record.detail,
      postings: postings?.length ? postings : undefined,
      amount: (() => {
        const summaryAmount = postingAmount(record);
        if (record.posting && summaryAmount) return amountText(summaryAmount);
        if (postings?.length) return "";
        return record.type;
      })(),
    };
  }

  function toUiGroup(group: JournalDateGroup) {
    return {
      id: group.key,
      date: groupDate(group),
      balance: balanceText(group.balance.final),
      summary: {
        start: balanceText(group.balance.start),
        change: balanceText(group.balance.change),
        final: balanceText(group.balance.final),
      },
      records: group.records.map(toUiRecord),
    };
  }

  function commitSelection(next: Set<string>) {
    const valid = [...next].filter((key) => recordMap.has(key));
    selectedKeys = new Set(valid);
    selectedRecords = valid
      .map((key) => recordMap.get(key))
      .filter((record): record is JournalRecord => Boolean(record));
  }

  function handleSelectionChange(next: string[]) {
    const nextSet = new Set(selectedKeys);
    for (const key of visibleKeys) {
      nextSet.delete(key);
    }
    for (const key of next) {
      nextSet.add(key);
    }
    commitSelection(nextSet);
  }

  function clearSelection() {
    commitSelection(new Set());
  }

  function selectAllRecords() {
    commitSelection(new Set(allRecords.map((record) => record.key)));
  }

  function openRecord(record: { id: string }) {
    const target = recordMap.get(record.id);
    if (!target) return;
    updateRoute({ record: target.key });
  }
</script>

<div class="h-full overflow-y-auto p-3 sm:p-5">
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-4">
    <ToggleGroup.Root
      type="single"
      value={timeframe}
      aria-label="Activity timeframe"
      class="!gap-0 self-start rounded-lg bg-muted p-1"
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

    {#if !readOnly && showSelectionBanner}
      <div
        data-activity-selection-banner
        role="status"
        class="rounded-xl border bg-card px-4 py-3 text-center text-sm text-muted-foreground"
      >
        {#if allMatchingSelected}
          All {allRecords.length}
          account activity records selected.
          <button
            type="button"
            class="font-medium text-primary underline-offset-2 hover:underline"
            onclick={clearSelection}
          >
            Clear selection
          </button>
        {:else}
          All {visibleRecords.length} records on this page are selected.
          <button
            type="button"
            class="font-medium text-primary underline-offset-2 hover:underline"
            onclick={selectAllRecords}
          >
            Select all {allRecords.length} account activity records
          </button>
        {/if}
      </div>
    {/if}

    {#if !visibleRecords.length}
      <div class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    {:else}
      <AccountActivityTable
        groups={groupsForTable}
        selectedIds={selectedRecordIds}
        selectable={!readOnly}
        amountHeading="Balance"
        balanceDescription="Shows the running balance for this account on this date"
        {emptyMessage}
        onSelectedIdsChange={handleSelectionChange}
        onOpenRecord={openRecord}
      />
    {/if}

    {#if pages.length > 1}
      <div
        class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <span class="text-sm text-muted-foreground">{page} of {pages.length}</span>
        <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div class="hidden items-center gap-2 sm:flex">
            <span
              class="text-sm text-muted-foreground"
              id={`account-activity-table-page-size-label`}
              >Page size</span
            >
            <Select.Root
              type="single"
              value={String(pageSize)}
              onValueChange={(value) =>
                updateRoute({
                  pageSize: value,
                  page: "1",
                })}
            >
              <Select.Trigger
                id={`account-activity-table-page-size`}
                aria-labelledby={`account-activity-table-page-size-label`}
                class="h-8 w-20 font-mono text-sm tabular-nums"
              >
                {pageSize}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  {#each PAGE_SIZES as size (size)}
                    <Select.Item value={String(size)} label={`${size} records`}>
                      {size}
                    </Select.Item>
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>
          <PagePagination
            page={page}
            pageCount={pages.length}
            ariaLabel="Account activity pages"
            onPageChange={(nextPage) =>
              updateRoute({ page: String(nextPage) })}
          />
        </div>
      </div>
    {/if}
  </div>
</div>

{#if !readOnly}
  <AccountBulkActionSheet
    bind:open={bulkSheetOpen}
    records={selectedRecords}
    focusedAccount={account}
    onApplied={clearSelection}
  />
{/if}
