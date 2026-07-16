<script lang="ts">
  import { onDestroy } from "svelte";
  import { SearchFilterBar } from "@beancount-js/forms";
  import ChevronsLeft from "lucide-svelte/icons/chevrons-left";
  import ChevronsRight from "lucide-svelte/icons/chevrons-right";
  import FileCode2 from "lucide-svelte/icons/file-code-2";
  import Landmark from "lucide-svelte/icons/landmark";
  import type { MerchantIdentity } from "@beancount-js/beangulp";
  import { Button } from "$lib/components/ui/button";
  import * as Alert from "$lib/components/ui/alert";
  import * as Empty from "$lib/components/ui/empty";
  import { useNavigation } from "../router/router";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import { debounceWithDelay } from "../hooks/debounce";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import MerchantEditSheet from "./MerchantEditSheet.svelte";
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
      if (currentPage > 1 && nextPages.length && currentPage > nextPages.length) {
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
          >Saved merchant profiles are available only through the local
          server.</Alert.Description
        >
      </Alert.Root>
    {:else if !project}
      <p class="text-sm text-muted-foreground">Open a project to manage merchants.</p>
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
            class="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground"
          >
            No merchants match this search.
          </div>
        {:else if merchants.length}
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

          <nav
            class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
            aria-label="Merchant pages"
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
            <div class="flex items-center gap-2">
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
                    pageSize: (event.currentTarget as HTMLSelectElement).value,
                    page: "1",
                  })}
              >
                {#each PAGE_SIZES as size (size)}
                  <option value={size}>{size}</option>
                {/each}
              </select>
              <Button
                size="icon"
                variant="outline"
                aria-label="Previous merchant page"
                disabled={page <= 1}
                onclick={() => updateRoute({ page: String(page - 1) })}
              >
                <ChevronsLeft />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Next merchant page"
                disabled={page >= pages.length}
                onclick={() => updateRoute({ page: String(page + 1) })}
              >
                <ChevronsRight />
              </Button>
            </div>
          </nav>
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

  .ingestion-merchant-manage-search :global(.cv-search-filter-bar__search-pill) {
    flex: 1 1 100%;
    width: 100%;
    max-width: none;
  }
</style>
