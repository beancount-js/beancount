<script lang="ts">
  import type { Amount, DirectiveBase } from "@beancount-js/beancount";
  import { DateTime } from "luxon";
  import { onDestroy } from "svelte";
  import JournalTable, {
    type ActivityGroup,
    type ActivityRecord,
  } from "@beancount-js/ui/tables/JournalTable.svelte";
  import { useContext } from "../context";
  import { useCtx } from "../stores/format";
  import { useNavigation } from "../router/router";
  import { urlForAccount } from "../helpers";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import AccountBulkActionSheet from "./AccountBulkActionSheet.svelte";
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

  const { conversion, ledgerData, ledgerSource, operatingCurrency } = useContext();
  const ctx = useCtx();
  const { activeRoute, router } = useNavigation();
  const { activeLedgerKind } = useStudioWorkspace();

  const PAGE_SIZES = [25, 50, 100];

  let selectedKeys = $state(new Set<string>());
  let selectedRecords = $state<JournalRecord[]>([]);
  let bulkSheetOpen = $state(false);

  const balanceRoots = $derived([
    $ledgerSource.options.beancount.name_assets,
    $ledgerSource.options.beancount.name_liabilities,
  ]);
  const balancesByDate = $derived(
    $ledgerSource.data.accountBalanceByDate($conversion, ...balanceRoots),
  );
  const readOnly = $derived($activeLedgerKind === "ingestion-review");
  const allRecords = $derived(
    journalRecords(
      $ledgerData.directives as readonly DirectiveBase[],
      balanceRoots,
    ),
  );
  const allGroups = $derived(groupJournalRecords(allRecords, balancesByDate));
  const timeframe = $derived(
    $activeRoute.query.view === "upcoming" ? "upcoming" : "transactions",
  );
  const groups = $derived(
    filterJournalGroupsByTimeframe(allGroups, timeframe, DateTime.now()),
  );
  const recordMap = $derived(
    new Map(allRecords.map((record) => [record.key, record])),
  );
  const pageSize = $derived(
    PAGE_SIZES.includes(Number($activeRoute.query.pageSize))
      ? Number($activeRoute.query.pageSize)
      : 50,
  );
  const pages = $derived(paginateJournalGroups(groups, pageSize));
  const requestedPage = $derived(Math.max(1, Number($activeRoute.query.page) || 1));
  const maxPage = $derived(Math.max(1, pages.length));
  const page = $derived(Math.min(requestedPage, maxPage));
  const visibleGroups = $derived(pages[page - 1] ?? []);
  const visibleRecords = $derived(
    visibleGroups.flatMap((group) => group.records),
  );
  const visibleKeys = $derived(visibleRecords.map((record) => record.key));
  const selectedRecordIds = $derived([...selectedKeys]);
  const groupsForTable = $derived(visibleGroups.map(toUiGroup));

  $effect(() => {
    if (readOnly) {
      ingestionHeaderActions.set(null);
      bulkSheetOpen = false;
      return;
    }
    ingestionHeaderActions.set({
      kind: "account-activity",
      selectedCount: selectedKeys.size,
      onReplace: () => {
        bulkSheetOpen = true;
      },
    });
  });

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
    const next: JournalTimeframe = value;
    updateRoute({
      view: next === "upcoming" ? "upcoming" : undefined,
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

  function toUiPosting(record: JournalRecord) {
    return record.postings
      ?.filter((posting) => posting.account)
      .map((posting) => ({
        account: posting.account,
        amount: amountText(posting.amount),
        href: posting.account ? urlForAccount(posting.account) : undefined,
      }));
  }

  function toUiRecord(record: JournalRecord): ActivityRecord {
    const postings = toUiPosting(record);
    const summaryAmount = postingAmount(record);

    return {
      id: record.key,
      title: record.title,
      detail: record.detail,
      type: record.type,
      amount:
        summaryAmount && record.posting
          ? amountText(summaryAmount)
          : postings?.length
            ? ""
            : record.type,
      postings: postings?.length ? postings : undefined,
    };
  }

  function toUiGroup(group: JournalDateGroup): ActivityGroup {
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

  function applySelection(next: Set<string>) {
    const valid = [...next].filter((key) => recordMap.has(key));
    selectedKeys = new Set(valid);
    selectedRecords = valid
      .map((key) => recordMap.get(key))
      .filter((record): record is JournalRecord => Boolean(record));
  }

  function handleSelectionChange(keys: string[]) {
    const next = new Set(selectedKeys);
    for (const key of visibleKeys) {
      next.delete(key);
    }
    for (const key of keys) {
      next.add(key);
    }
    applySelection(next);
  }

  function openRecord(record: ActivityRecord) {
    const target = recordMap.get(record.id);
    if (!target) return;
    updateRoute({ record: target.key });
  }

  function clearSelection() {
    selectedKeys = new Set();
    selectedRecords = [];
  }

  $effect(() => {
    if ([...selectedKeys].some((key) => !recordMap.has(key))) {
      applySelection(
        new Set([...selectedKeys].filter((key) => recordMap.has(key))),
      );
    }
  });

  onDestroy(() => ingestionHeaderActions.set(null));
</script>

<JournalTable
  groups={groupsForTable}
  selectedIds={selectedRecordIds}
  timeframe={timeframe}
  page={page}
  {pageSize}
  pageSizeOptions={PAGE_SIZES}
  selectable={!readOnly}
  recordLabel="journal"
  pageLabel="Journal"
  amountHeading="Amount"
  balanceDescription="Shows the net worth balance for this date"
  emptyMessage="No dated records match the current Journal filter."
  onTimeframeChange={setTimeframe}
  onPageChange={(nextPage) =>
    updateRoute({
      page: String(nextPage),
      record: undefined,
    })}
  onPageSizeChange={(size) =>
    updateRoute({
      pageSize: String(size),
      page: "1",
      record: undefined,
    })}
  onSelectedIdsChange={handleSelectionChange}
  onOpenRecord={openRecord}
/>

{#if !readOnly}
  <AccountBulkActionSheet
    bind:open={bulkSheetOpen}
    records={selectedRecords}
    onApplied={clearSelection}
  />
{/if}
