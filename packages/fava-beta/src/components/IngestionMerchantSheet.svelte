<script lang="ts">
  import { IngestionMerchantSheet } from "@lapis/ui/forms";
  import type {
    FilterCommandSearchAction,
    MerchantPickerMerchant,
  } from "@lapis/ui/forms";
  import type { MerchantReviewCluster } from "@beancount-js/server";
  import { useNavigation } from "../router/router";
  import { ingestionJson, ingestionPath } from "../ingestion/api";

  type Props = {
    open?: boolean;
    projectId: string;
    sourceId?: string;
    cluster: MerchantReviewCluster;
    readOnly?: boolean;
    onClosed?: () => void;
    onUpdated?: () => void;
    onStatus?: (message: string) => void;
  };

  let {
    open = $bindable(false),
    projectId,
    sourceId = "",
    cluster,
    readOnly = false,
    onClosed,
    onUpdated,
    onStatus,
  }: Props = $props();

  const { router } = useNavigation();

  let attachedMerchantId = $state("");
  let localMerchants = $state<MerchantPickerMerchant[]>([]);
  let localMerchantMessages = $state<string[]>([]);
  let localMerchantBusy = $state(false);

  let previousProjectId = $state("");

  function openReview(tx: MerchantReviewCluster["transactions"][number]) {
    const query = new URLSearchParams({
      runId: tx.runId,
      proposalId: tx.proposalId,
    });
    if (sourceId) query.set("sourceId", sourceId);
    router.push(`/records?${query}`);
  }

  async function updateMerchant(
    request: {
      action: "confirm" | "correct" | "reject" | "clear-suppression";
      normalizedLabels: readonly string[];
      candidateId?: string;
      canonicalName?: string;
      domain?: string;
      description?: string;
      targetMerchantId?: string;
    },
  ) {
    await ingestionJson(
      ingestionPath(
        projectId,
        `/runs/${encodeURIComponent(cluster.primary.runId)}/proposals/${encodeURIComponent(cluster.primary.proposalId)}/merchant`,
      ),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      },
    );
  }

  async function detectMerchant(normalizedLabels: readonly string[]) {
    await ingestionJson(
      ingestionPath(
        projectId,
        `/runs/${encodeURIComponent(cluster.primary.runId)}/proposals/${encodeURIComponent(cluster.primary.proposalId)}/enrich`,
      ),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantOnly: true,
          normalizedLabels,
        }),
      },
    );
  }

  function domainFromUrl(inputValue: string) {
    const input = inputValue.trim();
    if (!input) return undefined;
    try {
      const url = new URL(
        /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`,
      );
      const nextDomain = url.hostname
        .toLowerCase()
        .replace(/^(?:www\.|api\.)/, "");
      return nextDomain.includes(".") ? nextDomain : undefined;
    } catch {
      return undefined;
    }
  }

  function brandMatchSearchAction(
    search: string,
  ): FilterCommandSearchAction | null | undefined {
    const nextDomain = domainFromUrl(search);
    if (!projectId || !sourceId || !nextDomain) return null;
    if (localMerchants.some((merchant) => merchant.domain?.toLowerCase() === nextDomain)) {
      return null;
    }

    return {
      label: `Create ${nextDomain} with Brand Match`,
      description: "Save a merchant with its Brandfetch logo.",
    } satisfies FilterCommandSearchAction;
  }

  async function createMerchantFromBrandMatch(url: string) {
    if (localMerchantBusy || !projectId || !sourceId) return;
    localMerchantBusy = true;
    localMerchantMessages = [];
    try {
      const merchant = await ingestionJson<MerchantPickerMerchant>(
        ingestionPath(projectId, "/merchants/brand-match"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, sourceId }),
        },
      );
      localMerchants = [
        merchant,
        ...localMerchants.filter((item) => item.merchantId !== merchant.merchantId),
      ].sort((left, right) =>
        left.canonicalName.localeCompare(right.canonicalName),
      );
      attachedMerchantId = merchant.merchantId;
    } catch (error) {
      localMerchantMessages = [
        error instanceof Error
          ? error.message
          : "Could not create a merchant from that URL.",
      ];
    } finally {
      localMerchantBusy = false;
    }
  }

  async function fetchMerchants(nextProjectId: string) {
    try {
      const listed = await ingestionJson<MerchantPickerMerchant[]>(
        ingestionPath(nextProjectId, "/merchants"),
      );
      if (nextProjectId !== projectId) return;
      localMerchants = Array.isArray(listed) ? listed : [];
      localMerchantMessages = [];
    } catch (error) {
      if (nextProjectId !== projectId) return;
      localMerchants = [];
      localMerchantMessages = [
        error instanceof Error ? error.message : "Failed to load merchants",
      ];
    }
  }

  $effect(() => {
    if (!projectId) {
      localMerchants = [];
      localMerchantMessages = [];
      return;
    }

    if (projectId === previousProjectId) return;
    previousProjectId = projectId;
    void fetchMerchants(projectId);
  });
</script>

<IngestionMerchantSheet
  bind:open
  bind:attachedMerchantId
  cluster={cluster}
  {readOnly}
  localMerchants={localMerchants}
  localMerchantMessages={localMerchantMessages}
  localMerchantSearchAction={brandMatchSearchAction}
  localMerchantSearchActionLabel="Brand Match"
  onLocalMerchantSearchAction={createMerchantFromBrandMatch}
  {onClosed}
  onOpenReview={openReview}
  onUpdateMerchant={updateMerchant}
  onDetectMerchant={detectMerchant}
  {onUpdated}
  {onStatus}
/>
