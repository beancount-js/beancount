<script module lang="ts">
  export type IngestionRunHistorySortKey =
    | "date"
    | "proposals"
    | "accepted"
    | "review"
    | "duplicates";
  export type IngestionRunHistorySortOrder = "none" | "asc" | "desc";

  export type IngestionRunHistoryRow = {
    id: string;
    href: string;
    sourceTitle: string;
    sourceName: string;
    sourceAccount?: string;
    sourceAccountHref?: string;
    sourceAccountColor?: string;
    sourceAccountIcon?: string;
    accountMerchantLogoUrl?: string;
    sourceMerchantId?: string;
    sourceMerchantLogoUrl?: string;
    reviewState: "pending" | "completed" | string;
    completedAtLabel: string;
    total: number;
    accepted: number;
    needsReview: number;
    duplicates: number;
  };

  export type IngestionRunHistoryGroup = {
    key: string;
    label: string;
    runs: IngestionRunHistoryRow[];
  };

  type IngestionRunHistorySortColumn = {
    key: IngestionRunHistorySortKey;
    label: string;
    description: string;
  };

  export type IngestionRunHistoryProps = {
    isWeb?: boolean;
    hasProject?: boolean;
    loading?: boolean;
    status?: string;
    groups?: readonly IngestionRunHistoryGroup[];
    sortOrders?: Record<
      IngestionRunHistorySortKey,
      IngestionRunHistorySortOrder
    >;
    page?: number;
    pageCount?: number;
    pageSize?: number;
    pageSizeOptions?: readonly number[];
    onCycleSort?: (key: IngestionRunHistorySortKey) => void;
    onRunLinkClick?: (event: MouseEvent, runId: string) => void;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };

  const DEFAULT_PAGE_SIZES = [25, 50, 100];
  const DEFAULT_SORT_ORDERS: Record<
    IngestionRunHistorySortKey,
    IngestionRunHistorySortOrder
  > = {
    date: "none",
    proposals: "none",
    accepted: "none",
    review: "none",
    duplicates: "none",
  };

  const SORT_COLUMNS: readonly IngestionRunHistorySortColumn[] = [
    { key: "proposals", label: "Proposals", description: "proposal count" },
    { key: "accepted", label: "Accepted", description: "accepted count" },
    { key: "review", label: "Review", description: "review count" },
    { key: "duplicates", label: "Duplicates", description: "duplicate count" },
  ];
</script>

<script lang="ts">
  import ArrowDownWideNarrow from "lucide-svelte/icons/arrow-down-wide-narrow";
  import ArrowUpDown from "lucide-svelte/icons/arrow-up-down";
  import ArrowUpNarrowWide from "lucide-svelte/icons/arrow-up-narrow-wide";
  import * as Empty from "../shadcn/empty";
  import AccountAvatar from "../forms/AccountAvatar.svelte";
  import { accountAvatarInitial } from "../forms/account-avatar";
  import PagePagination from "../navigation/PagePagination.svelte";

  let {
    isWeb = false,
    hasProject = false,
    loading = false,
    status = "",
    groups = [],
    sortOrders = DEFAULT_SORT_ORDERS,
    page = 1,
    pageCount = 1,
    pageSize = 25,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    onCycleSort = () => {},
    onRunLinkClick = () => {},
    onPageChange = () => {},
    onPageSizeChange = () => {},
  }: IngestionRunHistoryProps = $props();

  let failedMerchantLogoIds = $state(new Set<string>());

  function markMerchantLogoFailed(merchantId: string) {
    failedMerchantLogoIds = new Set([...failedMerchantLogoIds, merchantId]);
  }

  function sortLabel(key: IngestionRunHistorySortKey) {
    const order = sortOrders[key];
    if (order === "asc") return "ascending";
    if (order === "desc") return "descending";
    return "not sorted";
  }
</script>

<section class="h-full overflow-auto p-3 sm:p-5" data-ingestion-history>
  {#if !hasProject}
    <div class="rounded-md border p-4 text-sm text-muted-foreground">
      Open a project to view import history.
    </div>
  {:else if isWeb}
    <div class="rounded-md border p-4 text-sm text-muted-foreground">
      Import history is available when Studio has access to the project folder.
    </div>
  {:else}
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-4">
      {#if status}
        <p
          class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="status"
        >
          {status}
        </p>
      {/if}

      {#if loading && groups.length === 0}
        <div class="rounded-xl border p-6 text-sm text-muted-foreground">
          Loading archived runs...
        </div>
      {:else if groups.length === 0}
        <Empty.Root class="border">
          <Empty.Header>
            <Empty.Title>No import runs yet</Empty.Title>
            <Empty.Description>
              Completed and pending ingestion runs will appear here.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <div
          class="hidden grid-cols-[minmax(0,1fr)_repeat(4,5rem)] items-center gap-x-6 rounded-2xl bg-muted px-5 py-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid"
        >
          <div class="justify-self-start">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Sort by date, currently ${sortLabel("date")}`}
              onclick={() => onCycleSort("date")}
            >
              Date
              {#if sortOrders.date === "asc"}
                <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
              {:else if sortOrders.date === "desc"}
                <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
              {:else}
                <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
              {/if}
            </button>
          </div>
          {#each SORT_COLUMNS as column (column.key)}
            <div class="justify-self-center">
              <button
                type="button"
                class="inline-flex items-center justify-center gap-1.5 rounded-md outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Sort by ${column.description}, currently ${sortLabel(column.key)}`}
                onclick={() => onCycleSort(column.key)}
              >
                {column.label}
                {#if sortOrders[column.key] === "asc"}
                  <ArrowUpNarrowWide class="size-3.5" aria-hidden="true" />
                {:else if sortOrders[column.key] === "desc"}
                  <ArrowDownWideNarrow class="size-3.5" aria-hidden="true" />
                {:else}
                  <ArrowUpDown class="size-3.5 opacity-50" aria-hidden="true" />
                {/if}
              </button>
            </div>
          {/each}
        </div>

        {#each groups as group (group.key)}
          <section
            class="overflow-hidden rounded-2xl bg-muted/80"
            aria-label={`Import runs from ${group.label}`}
          >
            <div class="px-5 py-4">
              <h2 class="text-sm font-semibold tracking-wide text-foreground">
                {group.label}
                <span class="ml-2 text-muted-foreground">· {group.runs.length}</span>
              </h2>
            </div>
            <div class="mx-1 mb-1 overflow-hidden rounded-xl border bg-card shadow-sm">
              {#each group.runs as run, index (run.id)}
                <div
                  class:rounded-b-xl={index === group.runs.length - 1}
                  class="relative grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b px-4 py-4 transition-colors last:border-b-0 focus-within:bg-accent focus-within:ring-2 focus-within:ring-ring hover:bg-accent/60 sm:grid-cols-[minmax(0,1fr)_repeat(4,5rem)] sm:gap-x-6"
                >
                  <a
                    href={run.href}
                    class="absolute inset-0 z-0 rounded-[inherit] outline-none"
                    aria-label={`${run.reviewState === "pending" ? "Review" : "View audit for"} ${run.sourceTitle}`}
                    onclick={(event) => onRunLinkClick(event, run.id)}
                  ></a>

                  <div class="pointer-events-none relative z-10 col-span-2 min-w-0 sm:col-span-1 sm:row-span-2">
                    <div class="flex min-w-0 items-start gap-3">
                      <AccountAvatar
                        account={run.sourceAccount ?? run.sourceTitle}
                        color={run.sourceAccountColor ?? ""}
                        icon={run.sourceAccountIcon ?? ""}
                        merchantLogoUrl={run.accountMerchantLogoUrl}
                      />
                      <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-center gap-2">
                          <h3 class="min-w-0 truncate text-sm font-semibold">
                            {run.sourceTitle}
                          </h3>
                        </div>
                        {#if run.sourceAccount && run.sourceAccountHref}
                          <a
                            class="pointer-events-auto relative z-10 mt-1 block truncate text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            href={run.sourceAccountHref}
                            title={run.sourceAccount}
                            >{run.sourceAccount}</a
                          >
                        {/if}
                      </div>
                    </div>
                  </div>

                  <div class="pointer-events-none relative z-10 order-2 col-span-2 grid min-w-0 grid-cols-[6.75rem_1.25rem_4.5rem] items-center justify-end gap-2 sm:order-none sm:col-span-4 sm:col-start-2 sm:grid-cols-[6.75rem_8rem_4.5rem]">
                    <span
                      class={`justify-self-start rounded-full px-2 py-0.5 text-xs font-medium ${
                        run.reviewState === "pending"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {run.reviewState === "pending" ? "Pending review" : "Completed"}
                    </span>
                    <span
                      class="inline-flex size-5 items-center justify-center justify-self-start overflow-hidden rounded-full border border-border bg-muted text-[0.625rem] font-semibold text-muted-foreground sm:size-auto sm:max-w-32 sm:gap-1 sm:rounded-full sm:px-1 sm:py-0.5 sm:text-xs"
                      aria-label={`Source: ${run.sourceName}`}
                      title={`Source: ${run.sourceName}`}
                    >
                      {#if run.sourceMerchantLogoUrl && run.sourceMerchantId && !failedMerchantLogoIds.has(run.sourceMerchantId)}
                        <img
                          class="size-full object-cover sm:size-3.5 sm:rounded-full"
                          src={run.sourceMerchantLogoUrl}
                          alt=""
                          onerror={() =>
                            run.sourceMerchantId
                              ? markMerchantLogoFailed(run.sourceMerchantId)
                              : undefined}
                        />
                      {:else}
                        <span
                          class="grid size-full place-items-center bg-rose-200 text-rose-800 sm:size-3.5 sm:rounded-full"
                          aria-hidden="true"
                        >
                          {accountAvatarInitial(run.sourceName)}
                        </span>
                      {/if}
                      <span class="hidden min-w-0 truncate sm:inline">{run.sourceName}</span>
                    </span>
                    <span class="justify-self-end whitespace-nowrap text-xs text-muted-foreground">
                      {run.completedAtLabel}
                    </span>
                  </div>

                  <div class="pointer-events-none relative z-10 order-3 col-span-2 grid grid-cols-4 gap-3 text-center text-xs text-muted-foreground sm:order-none sm:col-span-4 sm:col-start-2 sm:gap-x-6 sm:text-sm">
                    <span
                      class="font-medium tabular-nums text-foreground sm:text-center"
                      aria-label={`${run.total} proposals`}
                      >{run.total}</span
                    >
                    <span class="tabular-nums sm:text-center" aria-label={`${run.accepted} accepted`}>
                      {run.accepted}
                    </span>
                    <span class="tabular-nums sm:text-center" aria-label={`${run.needsReview} need review`}>
                      {run.needsReview}
                    </span>
                    <span class="tabular-nums sm:text-center" aria-label={`${run.duplicates} duplicates`}>
                      {run.duplicates}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/each}

        {#if pageCount > 1}
          <div
            class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-import-history-pagination
          >
            <span class="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
            <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <div class="hidden items-center gap-2 sm:flex">
                <label class="text-sm text-muted-foreground" for="history-page-size">
                  Records per page
                </label>
                <select
                  id="history-page-size"
                  class="h-8 rounded-md border bg-background px-2 text-sm"
                  value={pageSize}
                  onchange={(event) =>
                    onPageSizeChange(
                      Number((event.currentTarget as HTMLSelectElement).value),
                    )}
                >
                  {#each pageSizeOptions as size (size)}
                    <option value={size}>{size}</option>
                  {/each}
                </select>
              </div>
              <PagePagination
                {page}
                {pageCount}
                ariaLabel="Import history pages"
                disabled={loading}
                onPageChange={onPageChange}
              />
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</section>
