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

  function handleRowKeydown(event: KeyboardEvent, merchant: MerchantIdentity) {
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
    return options.includes(pageSize)
      ? pageSize
      : (options[1] ?? options[0] ?? 25);
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
  class="cn-pages-ingestionmerchantmanage-129-1"
  data-ingestion-merchant-manage
>
  <div class="cn-pages-ingestionmerchantmanage-132-1">
    {#if isWeb}
      <Alert.Root>
        <FileCode2 />
        <Alert.Title>Local server required</Alert.Title>
        <Alert.Description
          >Saved merchant profiles are available only through the local server.</Alert.Description
        >
      </Alert.Root>
    {:else if !hasProject}
      <p class="cn-pages-ingestionmerchantmanage-142-1">
        Open a project to manage merchants.
      </p>
    {:else}
      {#if status}
        <p class="cn-pages-ingestionmerchantmanage-145-1" role="status">
          {status}
        </p>
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
            {onClearSearch}
            onClearAll={onClearSearch}
          />
        </div>

        {#if activeSearch && !normalizedMerchants.length}
          <div class="cn-pages-ingestionmerchantmanage-172-1">
            No merchants match this search.
          </div>
        {:else if normalizedMerchants.length}
          <div class="cn-pages-ingestionmerchantmanage-177-1">
            {#each visibleMerchants as merchant (merchant.merchantId)}
              <div
                role="button"
                tabindex="0"
                class="cn-pages-ingestionmerchantmanage-182-1"
                aria-label={`Edit merchant ${merchant.canonicalName}`}
                onclick={() => openMerchant(merchant)}
                onkeydown={(event) => handleRowKeydown(event, merchant)}
              >
                {#if merchant.logoUrl && !failedLogoIds.has(merchant.merchantId)}
                  <img
                    class="cn-pages-ingestionmerchantmanage-189-1"
                    src={merchant.logoUrl}
                    alt=""
                    onerror={() => markLogoFailed(merchant.merchantId)}
                  />
                {:else}
                  <div
                    class="cn-pages-ingestionmerchantmanage-196-1"
                    aria-hidden="true"
                  >
                    {merchantInitial(merchant)}
                  </div>
                {/if}
                <div class="cn-pages-ingestionmerchantmanage-202-1">
                  <div class="cn-pages-ingestionmerchantmanage-203-1">
                    {merchant.canonicalName}
                  </div>
                  <div class="cn-pages-ingestionmerchantmanage-206-1">
                    {merchantDetail(merchant)}
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <div
            class="cn-pages-ingestionmerchantmanage-215-1"
            data-merchant-pagination
          >
            <span class="cn-pages-ingestionmerchantmanage-218-1">
              {#if pages.length > 1}
                Page {currentPage} of {pages.length}
                <span class="cn-pages-ingestionmerchantmanage-221-1">
                  · {normalizedMerchants.length} merchant{normalizedMerchants.length ===
                  1
                    ? ""
                    : "s"}</span
                >
              {:else}
                {normalizedMerchants.length} merchant{normalizedMerchants.length ===
                1
                  ? ""
                  : "s"}
              {/if}
            </span>
            <div class="cn-pages-ingestionmerchantmanage-233-1">
              <div class="cn-pages-ingestionmerchantmanage-235-1">
                <label
                  class="cn-pages-ingestionmerchantmanage-237-1"
                  for="ingestion-merchant-manage-page-size"
                  >Records per page</label
                >
                <select
                  id="ingestion-merchant-manage-page-size"
                  class="cn-pages-ingestionmerchantmanage-243-1"
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
          <Empty.Root class="cn-pages-ingestionmerchantmanage-266-1">
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
