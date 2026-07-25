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

<section class="cn-pages-ingestionrunhistory-122-1" data-ingestion-history>
  {#if !hasProject}
    <div class="cn-pages-ingestionrunhistory-124-1">
      Open a project to view import history.
    </div>
  {:else if isWeb}
    <div class="cn-pages-ingestionrunhistory-128-1">
      Import history is available when Studio has access to the project folder.
    </div>
  {:else}
    <div class="cn-pages-ingestionrunhistory-132-1">
      {#if status}
        <p class="cn-pages-ingestionrunhistory-135-1" role="status">
          {status}
        </p>
      {/if}

      {#if loading && groups.length === 0}
        <div class="cn-pages-ingestionrunhistory-143-1">
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
        <div class="cn-pages-ingestionrunhistory-157-1">
          <div class="cn-pages-ingestionrunhistory-159-1">
            <button
              type="button"
              class="cn-pages-ingestionrunhistory-162-1"
              aria-label={`Sort by date, currently ${sortLabel("date")}`}
              onclick={() => onCycleSort("date")}
            >
              Date
              {#if sortOrders.date === "asc"}
                <ArrowUpNarrowWide
                  class="cn-pages-ingestionrunhistory-168-1"
                  aria-hidden="true"
                />
              {:else if sortOrders.date === "desc"}
                <ArrowDownWideNarrow
                  class="cn-pages-ingestionrunhistory-170-1"
                  aria-hidden="true"
                />
              {:else}
                <ArrowUpDown
                  class="cn-pages-ingestionrunhistory-172-1"
                  aria-hidden="true"
                />
              {/if}
            </button>
          </div>
          {#each SORT_COLUMNS as column (column.key)}
            <div class="cn-pages-ingestionrunhistory-177-1">
              <button
                type="button"
                class="cn-pages-ingestionrunhistory-180-1"
                aria-label={`Sort by ${column.description}, currently ${sortLabel(column.key)}`}
                onclick={() => onCycleSort(column.key)}
              >
                {column.label}
                {#if sortOrders[column.key] === "asc"}
                  <ArrowUpNarrowWide
                    class="cn-pages-ingestionrunhistory-186-1"
                    aria-hidden="true"
                  />
                {:else if sortOrders[column.key] === "desc"}
                  <ArrowDownWideNarrow
                    class="cn-pages-ingestionrunhistory-188-1"
                    aria-hidden="true"
                  />
                {:else}
                  <ArrowUpDown
                    class="cn-pages-ingestionrunhistory-190-1"
                    aria-hidden="true"
                  />
                {/if}
              </button>
            </div>
          {/each}
        </div>

        {#each groups as group (group.key)}
          <section
            class="cn-pages-ingestionrunhistory-199-1"
            aria-label={`Import runs from ${group.label}`}
          >
            <div class="cn-pages-ingestionrunhistory-202-1">
              <h2 class="cn-pages-ingestionrunhistory-203-1">
                {group.label}
                <span class="cn-pages-ingestionrunhistory-205-1"
                  >· {group.runs.length}</span
                >
              </h2>
            </div>
            <div class="cn-pages-ingestionrunhistory-208-1">
              {#each group.runs as run, index (run.id)}
                <div
                  class:cn-pages-ingestionrunhistory-211-1={index ===
                    group.runs.length - 1}
                  class="cn-pages-ingestionrunhistory-212-1"
                >
                  <a
                    href={run.href}
                    class="cn-pages-ingestionrunhistory-216-1"
                    aria-label={`${run.reviewState === "pending" ? "Review" : "View audit for"} ${run.sourceTitle}`}
                    onclick={(event) => onRunLinkClick(event, run.id)}
                  ></a>

                  <div class="cn-pages-ingestionrunhistory-221-1">
                    <div class="cn-pages-ingestionrunhistory-222-1">
                      <AccountAvatar
                        account={run.sourceAccount ?? run.sourceTitle}
                        color={run.sourceAccountColor ?? ""}
                        icon={run.sourceAccountIcon ?? ""}
                        merchantLogoUrl={run.accountMerchantLogoUrl}
                      />
                      <div class="cn-pages-ingestionrunhistory-229-1">
                        <div class="cn-pages-ingestionrunhistory-230-1">
                          <h3 class="cn-pages-ingestionrunhistory-231-1">
                            {run.sourceTitle}
                          </h3>
                        </div>
                        {#if run.sourceAccount && run.sourceAccountHref}
                          <a
                            class="cn-pages-ingestionrunhistory-237-1"
                            href={run.sourceAccountHref}
                            title={run.sourceAccount}>{run.sourceAccount}</a
                          >
                        {/if}
                      </div>
                    </div>
                  </div>

                  <div class="cn-pages-ingestionrunhistory-247-1">
                    <span
                      class={`justify-self-start rounded-full px-2 py-0.5 text-xs font-medium ${
                        run.reviewState === "pending"
                          ? "cn-pages-ingestionrunhistory-251-1"
                          : "cn-pages-ingestionrunhistory-252-1"
                      }`}
                    >
                      {run.reviewState === "pending"
                        ? "Pending review"
                        : "Completed"}
                    </span>
                    <span
                      class="cn-pages-ingestionrunhistory-258-1"
                      aria-label={`Source: ${run.sourceName}`}
                      title={`Source: ${run.sourceName}`}
                    >
                      {#if run.sourceMerchantLogoUrl && run.sourceMerchantId && !failedMerchantLogoIds.has(run.sourceMerchantId)}
                        <img
                          class="cn-pages-ingestionrunhistory-264-1"
                          src={run.sourceMerchantLogoUrl}
                          alt=""
                          onerror={() =>
                            run.sourceMerchantId
                              ? markMerchantLogoFailed(run.sourceMerchantId)
                              : undefined}
                        />
                      {:else}
                        <span
                          class="cn-pages-ingestionrunhistory-274-1"
                          aria-hidden="true"
                        >
                          {accountAvatarInitial(run.sourceName)}
                        </span>
                      {/if}
                      <span class="cn-pages-ingestionrunhistory-280-1"
                        >{run.sourceName}</span
                      >
                    </span>
                    <span class="cn-pages-ingestionrunhistory-282-1">
                      {run.completedAtLabel}
                    </span>
                  </div>

                  <div class="cn-pages-ingestionrunhistory-287-1">
                    <span
                      class="cn-pages-ingestionrunhistory-289-1"
                      aria-label={`${run.total} proposals`}>{run.total}</span
                    >
                    <span
                      class="cn-pages-ingestionrunhistory-293-1"
                      aria-label={`${run.accepted} accepted`}
                    >
                      {run.accepted}
                    </span>
                    <span
                      class="cn-pages-ingestionrunhistory-296-1"
                      aria-label={`${run.needsReview} need review`}
                    >
                      {run.needsReview}
                    </span>
                    <span
                      class="cn-pages-ingestionrunhistory-299-1"
                      aria-label={`${run.duplicates} duplicates`}
                    >
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
            class="cn-pages-ingestionrunhistory-311-1"
            data-import-history-pagination
          >
            <span class="cn-pages-ingestionrunhistory-314-1"
              >Page {page} of {pageCount}</span
            >
            <div class="cn-pages-ingestionrunhistory-315-1">
              <div class="cn-pages-ingestionrunhistory-316-1">
                <label
                  class="cn-pages-ingestionrunhistory-317-1"
                  for="history-page-size"
                >
                  Records per page
                </label>
                <select
                  id="history-page-size"
                  class="cn-pages-ingestionrunhistory-322-1"
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
                {onPageChange}
              />
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</section>
