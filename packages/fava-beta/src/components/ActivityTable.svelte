<script lang="ts">
  import type { Amount, DirectiveBase } from "@beancount-js/beancount";
  import { DateTime } from "luxon";
  import { useContext } from "../context";
  import { useCtx } from "../stores/format";
  import { useNavigation } from "../router/router";
  import { useStudioWorkspace } from "../studio/workspace";
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type { IngestionConfigResponse } from "../ingestion/types";
  import { urlForAccount } from "../helpers";
  import ActivityTable, {
    type ActivityGroup,
    type ActivityPosting,
    type ActivityRecord,
  } from "@lapis/ui/tables/ActivityTable.svelte";
  import {
    buildJournalMerchantLogoMaps,
    journalMerchantLogoFromReviewCluster,
    resolveJournalMerchantLogo,
    type JournalMerchantLogo,
    type JournalMerchantLogoMaps,
  } from "../lib/journal-merchant-logos";
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
  const ctx = useCtx();
  const { activeRoute, router } = useNavigation();
  const { snapshot } = useStudioWorkspace();

  type MerchantReviewResponse = {
    clusters: MerchantReviewCluster[];
  };

  export let directives: readonly DirectiveBase[] = [];
  export let balancesByDate: Record<string, Record<string, number>> = {};
  export let balanceRoots: readonly string[] = [];
  export let focusedAccount: string | undefined = undefined;
  export let tableId = "journal-table";
  export let recordLabel = "journal";
  export let pageLabel = "Journal";
  export let amountHeading = "Amount";
  export let balanceDescription = "Shows the net worth balance for this date";
  export let emptyMessage = "No dated records match the current Journal filter.";
  export let linkAccounts = false;
  /** Review ledgers retain inspection but cannot be bulk-edited. */
  export let selectable = true;
  /** Controlled selection; parent may bind or listen via onSelectionChange. */
  export let selectedKeys = new Set<string>();
  export let onSelectionChange:
    | ((keys: Set<string>, records: JournalRecord[]) => void)
    | undefined = undefined;

  let recordMap = new Map<string, JournalRecord>();
  let loadedMerchantProjectId = "";
  let merchantLogoMaps: JournalMerchantLogoMaps = {
    byId: new Map(),
    byNormalizedName: new Map(),
  };

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

  function toUiPosting(record: JournalRecord): readonly ActivityPosting[] | undefined {
    const postings = record.postings
      ?.filter((posting) => posting.account)
      .map((posting) => ({
        account: posting.account,
        amount: amountText(posting.amount),
        href: linkAccounts && posting.account ? urlForAccount(posting.account) : undefined,
      }));

    return postings?.length ? postings : undefined;
  }

  function recordLogo(record: JournalRecord) {
    return resolveJournalMerchantLogo(record.directive, merchantLogoMaps);
  }

  function toUiRecord(record: JournalRecord): ActivityRecord {
    const postings = toUiPosting(record);
    const summaryAmount = postingAmount(record);

    return {
      id: record.key,
      title: record.title,
      detail: record.detail,
      type: record.type,
      amount: summaryAmount && record.posting
        ? amountText(summaryAmount)
        : postings
          ? ""
          : record.type,
      logoUrl: recordLogo(record),
      logoFallback: record.title.slice(0, 1).toUpperCase(),
      postings,
    };
  }

  let projectId = "";
  let selectedRecordIds: string[] = [];
  let page = 1;
  let requestedPage = 1;
  let pages: JournalDateGroup[][] = [];

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

  function applySelection(next: Iterable<string>) {
    const valid = [...new Set(next)].filter((key) => recordMap.has(key));
    selectedKeys = new Set(valid);
    onSelectionChange?.(
      selectedKeys,
      valid
        .map((key) => recordMap.get(key))
        .filter((record): record is JournalRecord => Boolean(record)),
    );
  }

  function handleSelectionChange(keys: string[]) {
    applySelection(keys);
  }

  function openRecord(record: ActivityRecord) {
    const target = recordMap.get(record.id);
    if (!target) return;
    updateRoute({ record: target.key });
  }

  async function suggestedMerchantLogos(projectId: string) {
    try {
      const config = await ingestionJson<IngestionConfigResponse>(
        ingestionPath(projectId),
      );
      const clusters = await Promise.all(
        config.sources.map(async (source) => {
          try {
            const response = await ingestionJson<MerchantReviewResponse>(
              ingestionPath(
                projectId,
                `/merchant-review?sourceId=${encodeURIComponent(source.id)}`,
              ),
            );
            return response.clusters;
          } catch {
            return [];
          }
        }),
      );
      return clusters
        .flat()
        .map(journalMerchantLogoFromReviewCluster)
        .filter((merchant): merchant is JournalMerchantLogo => Boolean(merchant));
    } catch {
      return [];
    }
  }

  async function loadMerchantLogos(projectId: string) {
    const [merchants, suggested] = await Promise.all([
      ingestionJson<JournalMerchantLogo[]>(ingestionPath(projectId, "/merchants"))
        .catch(() => []),
      suggestedMerchantLogos(projectId),
    ]);
    if (projectId !== $snapshot?.project.id) return;

    merchantLogoMaps = buildJournalMerchantLogoMaps([
      ...(Array.isArray(merchants) ? merchants : []),
      ...suggested,
    ]);
  }

  $: timeframe =
    $activeRoute.query.view === "upcoming" ? "upcoming" : "transactions";
  $: allRecords = journalRecords(directives, balanceRoots, focusedAccount);
  $: allGroups = groupJournalRecords(allRecords, balancesByDate);
  $: groups = filterJournalGroupsByTimeframe(
    allGroups,
    timeframe,
    DateTime.now(),
  );
  $: groupsForTable = groups.map(toUiGroup);
  $: recordMap = new Map(allRecords.map((record) => [record.key, record]));
  $: shownEmptyMessage =
    timeframe === "upcoming"
      ? "No upcoming dated records match the current filter."
      : emptyMessage;

  $: projectId = $snapshot?.project.id ?? "";
  $: if (!isWeb && projectId && projectId !== loadedMerchantProjectId) {
    loadedMerchantProjectId = projectId;
    void loadMerchantLogos(projectId);
  }

  $: if ([...selectedKeys].some((key) => !recordMap.has(key))) {
    applySelection([...selectedKeys].filter((key) => recordMap.has(key)));
  }

  $: pageSize = PAGE_SIZES.includes(Number($activeRoute.query.pageSize))
    ? Number($activeRoute.query.pageSize)
    : 50;
  $: pages = paginateJournalGroups(groups, pageSize);
  $: requestedPage = Math.max(1, Number($activeRoute.query.page) || 1);
  $: page = Math.min(requestedPage, Math.max(1, pages.length));
  $: selectedRecordIds = [...selectedKeys];
</script>

  <ActivityTable
  {tableId}
  groups={groupsForTable}
  selectedIds={selectedRecordIds}
  {selectable}
  {recordLabel}
  {pageLabel}
  {amountHeading}
  {balanceDescription}
  emptyMessage={shownEmptyMessage}
  timeframe={timeframe}
  page={page}
  {pageSize}
  pageSizeOptions={PAGE_SIZES}
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
