import {
  normalizeMerchant,
  type ImportProposal,
  type MerchantCandidate,
  type MerchantIdentity,
  type MerchantResolution,
} from "@beancount-js/beangulp";
import type { FilesystemMerchantStore } from "./merchant";

/** True when a merchant has domain, description, or brand enrichment worth storing. */
export function hasMerchantCatalogData(
  merchant: Pick<
    MerchantIdentity | MerchantCandidate,
    "domain" | "description" | "brand"
  >,
): boolean {
  return Boolean(
    merchant.domain?.trim() ||
      merchant.description?.trim() ||
      merchant.brand,
  );
}

/** Payee / merchant label used for persistence and alias matching. */
export function proposalMerchantLabel(
  proposal: Pick<ImportProposal, "transaction" | "merchantResolution">,
): string | undefined {
  const fromResolution =
    proposal.merchantResolution &&
    "rawLabel" in proposal.merchantResolution
      ? proposal.merchantResolution.rawLabel?.trim()
      : undefined;
  const fromTxn =
    proposal.transaction?.merchant?.trim() ||
    proposal.transaction?.payee?.trim() ||
    proposal.transaction?.narration?.trim();
  return fromResolution || fromTxn || undefined;
}

/**
 * Build a candidate for auto-persist on accept.
 * Only suggested candidates with domain, description, or brand data qualify.
 */
export function candidateForAutoPersist(
  proposal: ImportProposal,
): MerchantCandidate | undefined {
  const resolution = proposal.merchantResolution;
  if (!resolution || resolution.status === "suppressed") return undefined;
  if (resolution.status === "confirmed") return undefined;

  if (resolution.status === "suggested" && resolution.candidates.length) {
    const ranked = [...resolution.candidates].sort(
      (left, right) => (right.rawScore ?? 0) - (left.rawScore ?? 0),
    );
    const top = ranked[0];
    return top && hasMerchantCatalogData(top) ? top : undefined;
  }

  return undefined;
}

function confirmedResolution(
  rawLabel: string,
  merchant: MerchantIdentity,
  explanation: string,
): MerchantResolution {
  return {
    status: "confirmed",
    rawLabel,
    merchant,
    explanation,
  };
}

/**
 * Ensure a proposal has a persisted, confirmed merchant before accept rendering.
 * Skips suppressed resolutions and proposals with no usable label.
 */
export async function ensureProposalMerchantPersisted(
  merchants: FilesystemMerchantStore,
  projectId: string,
  sourceId: string,
  proposal: ImportProposal,
): Promise<ImportProposal> {
  if (proposal.merchantResolution?.status === "confirmed") {
    return proposal;
  }
  if (proposal.merchantResolution?.status === "suppressed") {
    return proposal;
  }

  const label = proposalMerchantLabel(proposal);
  if (!label) return proposal;

  const existing = await merchants.resolve(projectId, sourceId, label);
  if (
    existing?.status === "confirmed" &&
    hasMerchantCatalogData(existing.merchant)
  ) {
    return {
      ...proposal,
      merchantResolution: existing,
    };
  }

  const candidate = candidateForAutoPersist(proposal);
  if (!candidate) return proposal;

  let targetMerchantId: string | undefined;
  if (candidate.domain) {
    const byDomain = await merchants.findByDomain(projectId, candidate.domain);
    if (byDomain) targetMerchantId = byDomain.merchantId;
  }

  const merchant = await merchants.confirm(projectId, {
    sourceId,
    rawLabel: label,
    candidate,
    targetMerchantId,
  });

  return {
    ...proposal,
    merchantResolution: confirmedResolution(
      label,
      merchant,
      `Auto-persisted merchant ${merchant.canonicalName}.`,
    ),
  };
}

/** Persist merchants for many accept-bound proposals; dedupe confirms by label. */
export async function ensureProposalsMerchantsPersisted(
  merchants: FilesystemMerchantStore,
  projectId: string,
  sourceId: string,
  proposals: readonly ImportProposal[],
): Promise<ImportProposal[]> {
  const byLabel = new Map<string, MerchantResolution>();
  const next: ImportProposal[] = [];

  for (const proposal of proposals) {
    const label = proposalMerchantLabel(proposal);
    const key = label ? `${sourceId}\0${normalizeMerchant(label)}` : "";
    if (key && byLabel.has(key)) {
      next.push({
        ...proposal,
        merchantResolution: byLabel.get(key),
      });
      continue;
    }

    const persisted = await ensureProposalMerchantPersisted(
      merchants,
      projectId,
      sourceId,
      proposal,
    );
    if (
      key &&
      persisted.merchantResolution?.status === "confirmed"
    ) {
      byLabel.set(key, persisted.merchantResolution);
    }
    next.push(persisted);
  }

  return next;
}
