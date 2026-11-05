<script lang="ts">
  import { rowOpen } from "../lib/row-open";
  import { onDestroy } from "svelte";
  import { SearchFilterBar } from "@lapismd/design-core/filter";
  import { FileCode2 } from "@lucide/svelte";
  import { Landmark } from "@lucide/svelte";
  import type { MerchantIdentity } from "@beancount-js/beangulp";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { useNavigation } from "../router/router";
  import { useIngestionHeaderActions } from "../studio/ingestion-header-actions";
  const ingestionHeaderActions = useIngestionHeaderActions();
  import { useStudioWorkspace } from "../studio/workspace";
  import { debounceWithDelay } from "../hooks/debounce";
  import { useIngestionApi, ingestionPath } from "../ingestion/api";
  const { ingestionJson } = useIngestionApi();
  import MerchantEditSheet from "./MerchantEditSheet.svelte";
  import PagePagination from "./PagePagination.svelte";
  import MerchantsPageSkeleton from "./skeletons/MerchantsPageSkeleton.svelte";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  const PAGE_SIZES = [10, 25, 50, 100];
  const { snapshot } = useStudioWorkspace();
  const { router, activeRoute } = useNavigation();

  let merchants = $state<MerchantIdentity[]>([]);
  let loading = $state(false);
  let status = $state("");
  let searchQuery = $state("");
  let debouncedQuery = $state("");
  let loadedProjectId = $state("");
  let sheetOpen = $state(false);
  let failedLogoIds = $state(new Set<string>());
  let backfillBusy = $state(false);

  const project = $derived($snapshot);
  const queryMerchantId = $derived($activeRoute?.query?.merchantId ?? "");
  const activeSearch = $derived(Boolean(debouncedQuery.trim()));
  const pageSize = $derived(
    PAGE_SIZES.includes(Number($activeRoute?.query?.pageSize))
      ? Number($activeRoute.query.pageSize)
      : 25,
  );
  const pages = $derived(paginateMerchants(merchants, pageSize));
  const requestedPage = $derived(
    Math.max(1, Number($activeRoute?.query?.page) || 1),
  );
  const page = $derived(Math.min(requestedPage, Math.max(1, pages.length)));
  const visibleMerchants = $derived(pages[page - 1] ?? []);

  const [scheduleSearchReload, delaySearchReload] = debounceWithDelay(
    (query: string) => {
      debouncedQuery = query;
      resetPageToFirst();
    },
    300,
  );

  function paginateMerchants(
    items: readonly MerchantIdentity[],
    size: number,
  ): MerchantIdentity[][] {
    if (!items.length) return [];
    const result: MerchantIdentity[][] = [];
    for (let index = 0; index < items.length; index += size) {
      result.push(items.slice(index, index + size));
    }
    return result;
  }

  function resetPageToFirst() {
    const currentPage = Number($activeRoute?.query?.page) || 1;
    if (currentPage === 1) updateRoute({ page: undefined });
    else updateRoute({ page: "1" });
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

  function openMerchant(merchant: MerchantIdentity) {
    if (queryMerchantId === merchant.merchantId && sheetOpen) return;
    updateRoute({ merchantId: merchant.merchantId });
  }

  function closeMerchantSheet() {
    if (queryMerchantId) updateRoute({ merchantId: undefined });
  }

  function handleRowKeydown(event: KeyboardEvent, merchant: MerchantIdentity) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMerchant(merchant);
    }
  }

  function onSearchQueryInput(value: string) {
    searchQuery = value;
    scheduleSearchReload(value);
    delaySearchReload();
  }

  function clearSearchQuery() {
    searchQuery = "";
    debouncedQuery = "";
    resetPageToFirst();
  }

  async function loadMerchants() {
    if (!project || isWeb) return;
    loading = true;
    try {
      const queryParam = debouncedQuery.trim()
        ? `?query=${encodeURIComponent(debouncedQuery.trim())}`
        : "";
      merchants = await ingestionJson<MerchantIdentity[]>(
        ingestionPath(project.project.id, `/merchants${queryParam}`),
      );
      loadedProjectId = project.project.id;
      const nextPages = paginateMerchants(merchants, pageSize);
      const currentPage = Math.max(1, Number($activeRoute?.query?.page) || 1);
      if (
        currentPage > 1 &&
        nextPages.length &&
        currentPage > nextPages.length
      ) {
        updateRoute({ page: String(nextPages.length) });
      }
      status = "";
    } catch (error) {
      merchants = [];
      status = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  async function backfillFromLedger() {
    if (!project || isWeb || backfillBusy) return;
    const confirmed = window.confirm(
      "Prune thin merchant profiles (no domain, description, or brand), clear their merchant meta from transactions, and stamp merchant_id only where an enriched profile matches?",
    );
    if (!confirmed) return;

    backfillBusy = true;
    status = "Backfilling merchants…";
    try {
      const result = await ingestionJson<{
        removedProfiles: number;
        clearedTransactions: number;
        createdProfiles: number;
        patchedTransactions: number;
        skipped: number;
        snapshot: NonNullable<typeof project>;
      }>(ingestionPath(project.project.id, "/merchants/backfill"), {
        method: "POST",
      });
      snapshot.set(result.snapshot);
      await loadMerchants();
      status = `Backfill complete: ${result.removedProfiles} profile${result.removedProfiles === 1 ? "" : "s"} removed, ${result.clearedTransactions} transaction${result.clearedTransactions === 1 ? "" : "s"} cleared, ${result.patchedTransactions} transaction${result.patchedTransactions === 1 ? "" : "s"} linked, ${result.createdProfiles} profile${result.createdProfiles === 1 ? "" : "s"} created${result.skipped ? `, ${result.skipped} skipped` : ""}.`;
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    } finally {
      backfillBusy = false;
    }
  }

  $effect(() => {
    const projectId = project?.project.id;
    if (!projectId || isWeb) return;
    if (loadedProjectId !== projectId) {
      searchQuery = "";
      debouncedQuery = "";
      resetPageToFirst();
    }
    void debouncedQuery;
    void loadMerchants();
  });

  $effect(() => {
    if (!queryMerchantId) {
      sheetOpen = false;
      return;
    }
    sheetOpen = true;
  });

  $effect(() => {
    if (isWeb || !project) {
      ingestionHeaderActions.set(null);
      return;
    }
    ingestionHeaderActions.set({
      kind: "manage-merchants",
      merchantCount: merchants.length,
      backfillBusy,
      onBackfill: () => {
        void backfillFromLedger();
      },
    });
  });

  onDestroy(() => ingestionHeaderActions.set(null));
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
    {:else if !project}
      <p class="text-sm text-muted-foreground">
        Open a project to manage merchants.
      </p>
    {:else}
      {#if status}
        <p class="text-sm text-muted-foreground" role="status">{status}</p>
      {/if}

      {#if loading && !merchants.length}
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
            onClearSearch={clearSearchQuery}
            onClearAll={clearSearchQuery}
          />
        </div>

        {#if activeSearch && !merchants.length}
          <div
            class="rounded-2xl border bg-background p-8 text-center text-sm text-muted-foreground"
            data-merchant-manage-surface
          >
            No merchants match this search.
          </div>
        {:else if merchants.length}
          <div
            class="mx-1 overflow-hidden rounded-xl border bg-background shadow-sm"
            data-merchant-manage-surface
          >
            {#each visibleMerchants as merchant (merchant.merchantId)}
              <div
                role="group"
                class="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b px-[15px] py-4 outline-none transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Edit merchant ${merchant.canonicalName}`}
                use:rowOpen={() => openMerchant(merchant)}
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
                  <button
                    type="button"
                    class="text-left text-sm font-semibold focus-visible:outline focus-visible:outline-ring"
                    aria-label={`Edit merchant ${merchant.canonicalName}`}
                    onclick={() => openMerchant(merchant)}
                    >{merchant.canonicalName}</button
                  >
                  <div class="mt-1 truncate text-xs text-muted-foreground">
                    {merchantDetail(merchant)}
                  </div>
                </div>
              </div>
            {/each}
          </div>

          <div
            class="flex flex-col items-stretch gap-3 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            data-merchant-pagination
            data-merchant-manage-surface
          >
            <span class="text-sm text-muted-foreground">
              {#if pages.length > 1}
                Page {page} of {pages.length}
                <span class="text-muted-foreground/80">
                  · {merchants.length} merchant{merchants.length === 1
                    ? ""
                    : "s"}</span
                >
              {:else}
                {merchants.length} merchant{merchants.length === 1 ? "" : "s"}
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
                  value={pageSize}
                  onchange={(event) =>
                    updateRoute({
                      pageSize: (event.currentTarget as HTMLSelectElement)
                        .value,
                      page: "1",
                    })}
                >
                  {#each PAGE_SIZES as size (size)}
                    <option value={size}>{size}</option>
                  {/each}
                </select>
              </div>
              {#if pages.length > 1}
                <PagePagination
                  {page}
                  pageCount={pages.length}
                  ariaLabel="Merchant pages"
                  onPageChange={(nextPage) =>
                    updateRoute({ page: String(nextPage) })}
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

{#if project && queryMerchantId}
  {#key queryMerchantId}
    <MerchantEditSheet
      bind:open={sheetOpen}
      projectId={project.project.id}
      merchantId={queryMerchantId}
      onClosed={closeMerchantSheet}
      onUpdated={() => void loadMerchants()}
    />
  {/key}
{/if}

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
