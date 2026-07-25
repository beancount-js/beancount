<script lang="ts">
  import { onDestroy } from "svelte";
  import { debounceWithDelay } from "../hooks/debounce";
  import { useNavigation } from "../router/router";
  import type { MerchantIdentity } from "@beancount-js/beangulp";
  import SharedIngestionMerchantManage from "@beancount-js/ui/pages/IngestionMerchantManage.svelte";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import { useStudioWorkspace } from "../studio/workspace";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import MerchantEditSheet from "./MerchantEditSheet.svelte";

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
  let backfillBusy = $state(false);

  const project = $derived($snapshot);
  const queryMerchantId = $derived($activeRoute?.query?.merchantId ?? "");
  const activeSearch = $derived(Boolean(debouncedQuery.trim()));
  const pageSize = $derived(
    PAGE_SIZES.includes(Number($activeRoute?.query?.pageSize))
      ? Number($activeRoute?.query?.pageSize)
      : 25,
  );
  const requestedPage = $derived(
    Math.max(1, Number($activeRoute?.query?.page) || 1),
  );

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
    if (!items.length || !size || size < 1) return [];
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

  function openMerchant(merchant: MerchantIdentity) {
    if (queryMerchantId === merchant.merchantId && sheetOpen) return;
    updateRoute({ merchantId: merchant.merchantId });
  }

  function closeMerchantSheet() {
    if (queryMerchantId) updateRoute({ merchantId: undefined });
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

<SharedIngestionMerchantManage
  {isWeb}
  hasProject={Boolean(project)}
  {merchants}
  {loading}
  {status}
  {searchQuery}
  {activeSearch}
  {pageSize}
  pageSizeOptions={PAGE_SIZES}
  page={requestedPage}
  onSearchQueryInput={onSearchQueryInput}
  onClearSearch={clearSearchQuery}
  onOpenMerchant={openMerchant}
  onPageChange={(nextPage) => updateRoute({ page: String(nextPage) })}
  onPageSizeChange={(nextSize) => updateRoute({ pageSize: String(nextSize), page: "1" })}
/>

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
