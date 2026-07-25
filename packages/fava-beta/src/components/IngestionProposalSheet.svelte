<script lang="ts">
  import { IngestionProposalSheet } from "@lapis/ui/forms";
  import type {
    FilterCommandSearchAction,
    MerchantPickerMerchant,
  } from "@lapis/ui/forms";
  import { useContext } from "../context";
  import { ingestionJson, ingestionPath } from "../ingestion/api";
  import type {
    AiEnrichmentCallRecord,
    ImportProposal,
    IngestionRun,
  } from "../ingestion/types";

  type Props = {
    open?: boolean;
    proposal: ImportProposal;
    runId: string;
    projectId: string;
    allowedAccounts?: readonly string[];
    /** Full run audit retained for compatibility with older batched snapshots. */
    auditCalls?: readonly AiEnrichmentCallRecord[];
    aiEnabled?: boolean;
    readOnly?: boolean;
    onClosed?: () => void;
    onUpdated?: (run: IngestionRun) => void;
    onStatus?: (message: string) => void;
  };

  let {
    open = $bindable(false),
    proposal,
    runId,
    projectId,
    allowedAccounts = [],
    auditCalls = [],
    aiEnabled = false,
    readOnly = false,
    onClosed,
    onUpdated,
    onStatus,
  }: Props = $props();

  const { tags } = useContext();

  let attachedMerchantId = $state("");
  let localMerchants = $state<MerchantPickerMerchant[]>([]);
  let localMerchantMessages = $state<string[]>([]);
  let localMerchantBusy = $state(false);
  let previousProjectId = $state("");

  const proposalTransactionSourceId = $derived.by(() => proposal.transaction?.sourceId);

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
    if (
      !projectId ||
      !proposalTransactionSourceId ||
      !nextDomain ||
      localMerchants.some(
        (merchant) => merchant.domain?.toLowerCase() === nextDomain,
      )
    ) {
      return null;
    }

    return {
      label: `Create ${nextDomain} with Brand Match`,
      description: "Save a merchant with its Brandfetch logo.",
    } satisfies FilterCommandSearchAction;
  }

  async function createMerchantFromBrandMatch(url: string) {
    if (localMerchantBusy || !projectId || !proposalTransactionSourceId) return;
    localMerchantBusy = true;
    localMerchantMessages = [];
    try {
      const merchant = await ingestionJson<MerchantPickerMerchant>(
        ingestionPath(projectId, "/merchants/brand-match"),
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            url,
            sourceId: proposalTransactionSourceId,
          }),
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

  async function updateMerchant(request: {
    action: "confirm" | "correct" | "reject" | "clear-suppression";
    normalizedLabels: readonly string[];
    candidateId?: string;
    canonicalName?: string;
    domain?: string;
    description?: string;
    targetMerchantId?: string;
  }) {
    const response = await ingestionJson<{ run: IngestionRun }>(
      ingestionPath(
        projectId,
        `/runs/${encodeURIComponent(runId)}/proposals/${encodeURIComponent(proposal.id)}/merchant`,
      ),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      },
    );
    return response.run;
  }

  async function detectMerchant(normalizedLabels: readonly string[]) {
    const response = await ingestionJson<{ run: IngestionRun }>(
      ingestionPath(
        projectId,
        `/runs/${encodeURIComponent(runId)}/proposals/${encodeURIComponent(proposal.id)}/enrich`,
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
    return response.run;
  }

  async function setProposalStatus(
    status: "ready" | "needs-review",
    account?: string,
  ) {
    return await ingestionJson<IngestionRun>(
      ingestionPath(projectId, `/runs/${encodeURIComponent(runId)}`),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          status,
          ...(account ? { account } : {}),
        }),
      },
    );
  }

  async function saveProposal(
    proposalId: string,
    account: string | undefined,
    transaction: {
      bookedAt: string;
      amount: string;
      currency: string;
      merchant: string | undefined;
      payee: string;
      narration: string;
      tags: string[];
      links: string[];
      metadata: Record<string, string>;
    },
  ) {
    return await ingestionJson<IngestionRun>(
      ingestionPath(projectId, `/runs/${encodeURIComponent(runId)}`),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposalId,
          ...(account ? { account } : {}),
          transaction: {
            ...transaction,
          },
        }),
      },
    );
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

<IngestionProposalSheet
  bind:open
  {proposal}
  bind:attachedMerchantId
  {runId}
  {projectId}
  {allowedAccounts}
  {auditCalls}
  {aiEnabled}
  {readOnly}
  tags={$tags}
  localMerchants={localMerchants}
  localMerchantMessages={localMerchantMessages}
  localMerchantSearchAction={brandMatchSearchAction}
  localMerchantSearchActionLabel="Brand Match"
  onLocalMerchantSearchAction={createMerchantFromBrandMatch}
  {onClosed}
  onUpdateMerchant={updateMerchant}
  onDetectMerchant={detectMerchant}
  onSetProposalStatus={setProposalStatus}
  onSaveProposal={saveProposal}
  {onUpdated}
  {onStatus}
/>
