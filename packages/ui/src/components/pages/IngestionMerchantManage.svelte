<script lang="ts">
  import type { MerchantIdentity } from "@beancount-js/beangulp";
  import FileCode2 from "lucide-svelte/icons/file-code-2";
  import Landmark from "lucide-svelte/icons/landmark";
  import SearchFilterBar from "../forms/SearchFilterBar.svelte";
  import * as Alert from "../shadcn/alert";
  import * as Empty from "../shadcn/empty";
  import MerchantsPageSkeleton from "../feedback/MerchantsPageSkeleton.svelte";
  import PagePagination from "../navigation/PagePagination.svelte";

  const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

  type Props = {
    isWeb?: boolean;
    hasProject?: boolean;
    merchants?: readonly MerchantIdentity[];
    loading?: boolean;
    status?: string;
    searchQuery?: string;
    activeSearch?: boolean;
    pageSize?: number;
    pageSizeOptions?: readonly number[];
    page?: number;
    onSearchQueryInput?: (value: string) => void;
    onClearSearch?: () => void;
    onOpenMerchant?: (merchant: MerchantIdentity) => void;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };

  let {
    isWeb = false,
    hasProject = false,
    merchants = [],
    loading = false,
    status = "",
    searchQuery = "",
    activeSearch = false,
    pageSize = 25,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    page = 1,
    onSearchQueryInput = () => {},
    onClearSearch = () => {},
    onOpenMerchant = () => {},
    onPageChange = () => {},
    onPageSizeChange = () => {},
  }: Props = $props();

  let failedLogoIds = $state(new Set<string>());

  function paginateMerchants(
    items: readonly MerchantIdentity[],
    size: number,
  ): MerchantIdentity[][] {
    if (!items.length || !size || size < 1) return [];
    const result: MerchantIdentity[][] = [];
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  }

  function merchantInitial(merchant: MerchantIdentity) {
    return merchant.canonicalName.slice(0, 1).toUpperCase() || "?";
  }

  function merchantDetail(merchant: MerchantIdentity) {
    const domain = merchant.domain?.trim() || "No domain";
    const aliasCount = merchant.aliases.length;
    return `${domain} · ${aliasCount} alias${aliasCount === 1 ? "" : "es"}`;
  }

  function markLogoFailed(merchantId: string) {
    failedLogoIds = new Set([...failedLogoIds, merchantId]);
  }

  function handleRowKeydown(
    event: KeyboardEvent,
    merchant: MerchantIdentity,
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenMerchant(merchant);
    }
  }

  function onSelectPage(newPage: number) {
    onPageChange(newPage);
  }

  function onChangePageSize(nextSize: number) {
    onPageSizeChange(nextSize);
  }

  const normalizedMerchants = $derived(() => merchants);
  const normalizedPageSizes = $derived(() => {
    const seen = new Set<number>();
    const values = [];
    for (const value of pageSizeOptions) {
      if (typeof value === "number" && value > 0 && Number.isInteger(value)) {
        if (!seen.has(value)) {
          seen.add(value);
          values.push(value);
        }
      }
    }
    return values.length ? values : [...DEFAULT_PAGE_SIZES];
  });
  const normalizedPageSize = $derived(() => {
    const options = normalizedPageSizes;
    return options.includes(pageSize) ? pageSize : options[1] ?? options[0] ?? 25;
  });
  const pages = $derived(() =>
    paginateMerchants(normalizedMerchants, normalizedPageSize),
  );
  const pageCount = $derived(() => Math.max(1, pages.length));
  const currentPage = $derived(() => {
    const safePage = Math.max(1, Number(page) || 1);
    return Math.min(safePage, pageCount);
  });
  const visibleMerchants = $derived(() => pages[currentPage - 1] ?? []);

  function openMerchant(merchant: MerchantIdentity) {
    onOpenMerchant(merchant);
  }
</script>

<section
  class="h-full overflow-y-auto p-4 sm:p-6"
  data-ingestion-merchant-manage
>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-5">
    {#if isWeb}
      <Alert.Root>
        <FileCode2 />
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Saved merchant profiles are available only through the local server.</Alert.Description
        >
      </Alert.Root>
    {:else if !hasProject}
      <p class="text-sm text-muted-foreground">Open a project to manage merchants.</p>
    {:else}
      {#if status}
        <p class="text-sm text-muted-foreground" role="status">{status}</p>
      {/if}

      {#if loading && !normalizedMerchants.length}
        <MerchantsPageSkeleton />
      {:else}
        <div
          class="ingestion-merchant-manage-search"
          style="--cv-search-filter-justify: stretch; --cv-search-filter-content-justify: stretch; --cv-search-filter-max-width: 100%;"
        >
          <SearchFilterBar
            inputMode="plain"
            value={searchQuery}
            placeholder="Search merchants…"
            ariaLabel="Search merchants"
            clearSearchLabel="Clear search"
            clearAllLabel="Clear search"
            showClearAll={Boolean(searchQuery.trim())}
            clearAllDisabled={!searchQuery.trim()}
            onValueChange={onSearchQueryInput}
            onClearSearch={onClearSearch}
            onClearAll={onClearSearch}
          />
        </div>

        {#if activeSearch && !normalizedMerchants.length}
          <div
            class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
          >
            No merchants match this search.
          </div>
        {:else if normalizedMerchants.length}
          <div class="mx-1 overflow-hidden rounded-xl border bg-card shadow-sm">
            {#each visibleMerchants as merchant (merchant.merchantId)}
              <div
                role="button"
                tabindex="0"
                class="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b px-[15px] py-4 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Edit merchant ${merchant.canonicalName}`}
                onclick={() => openMerchant(merchant)}
                onkeydown={(event) => handleRowKeydown(event, merchant)}
              >
                {#if merchant.logoUrl && !failedLogoIds.has(merchant.merchantId)}
                  <img
                    class="size-10 rounded-full border object-contain"
                    src={merchant.logoUrl}
                    alt=""
                    onerror={() => markLogoFailed(merchant.merchantId)}
                  />
                {:else}
                  <div
                    class="flex size-10 items-center justify-center rounded-full border bg-muted text-sm font-semibold text-muted-foreground"
                    aria-hidden="true"
                  >
                    {merchantInitial(merchant)}
                  </div>
                {/if}
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold">
                    {merchant.canonicalName}
                  </div>
                  <div class="mt-1 truncate text-xs text-muted-foreground">
                    {merchantDetail(merchant)}
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <div
            class="flex flex-col items-stretch gap-3 rounded-xl border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-merchant-pagination
          >
            <span class="text-sm text-muted-foreground">
              {#if pages.length > 1}
                Page {currentPage} of {pages.length}
                <span class="text-muted-foreground/80">
                  · {normalizedMerchants.length} merchant{normalizedMerchants.length === 1
                    ? ""
                    : "s"}</span
                >
              {:else}
                {normalizedMerchants.length} merchant{normalizedMerchants.length === 1
                  ? ""
                  : "s"}
              {/if}
            </span>
            <div
              class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"
            >
              <div class="hidden items-center gap-2 sm:flex">
                <label
                  class="text-sm text-muted-foreground"
                  for="ingestion-merchant-manage-page-size"
                  >Records per page</label
                >
                <select
                  id="ingestion-merchant-manage-page-size"
                  class="h-8 rounded-md border bg-background px-2 text-sm"
                  value={normalizedPageSize}
                  onchange={(event) =>
                    onChangePageSize(
                      Number((event.currentTarget as HTMLSelectElement).value),
                    )}
                >
                  {#each normalizedPageSizes as size (size)}
                    <option value={size}>{size}</option>
                  {/each}
                </select>
              </div>
              {#if pages.length > 1}
                <PagePagination
                  page={currentPage}
                  pageCount={pages.length}
                  ariaLabel="Merchant pages"
                  onPageChange={onSelectPage}
                />
              {/if}
            </div>
          </div>
        {:else}
          <Empty.Root class="min-h-64 border">
            <Empty.Header>
              <Empty.Media variant="icon"><Landmark /></Empty.Media>
              <Empty.Title>No saved merchants</Empty.Title>
              <Empty.Description
                >Confirm merchants during import review to build your saved
                catalog.</Empty.Description
              >
            </Empty.Header>
          </Empty.Root>
        {/if}
      {/if}
    {/if}
  </div>
</section>

<style>
  .ingestion-merchant-manage-search :global(.cv-search-filter-bar) {
    padding: 0;
  }

  .ingestion-merchant-manage-search
    :global(.cv-search-filter-bar__search-pill) {
    flex: 1 1 100%;
    width: 100%;
    max-width: none;
  }
</style>
