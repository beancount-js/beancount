import {
  AUTO_READY_SCORE_THRESHOLD,
  normalizeMerchant,
  type ImportProposal,
  type MerchantCandidate,
  type MerchantIdentity,
  type MerchantResolution,
} from "@beancount-js/beangulp";
import { isValidDomain } from "./brandfetch";
import type { FilesystemMerchantStore } from "./merchant";

/** Shares the confidence bar used for automatic category acceptance. */
export const MERCHANT_AUTO_CONFIRM_SCORE_THRESHOLD = AUTO_READY_SCORE_THRESHOLD;

/** True when a merchant has domain, description, or brand enrichment worth storing. */
export function hasMerchantCatalogData(
  merchant: Pick<
    MerchantIdentity | MerchantCandidate,
    "domain" | "description" | "brand"
  >,
): boolean {
  return Boolean(
    merchant.domain?.trim() || merchant.description?.trim() || merchant.brand,
  );
}

/** Payee / merchant label used for persistence and alias matching. */
export function proposalMerchantLabel(
  proposal: Pick<ImportProposal, "transaction" | "merchantResolution">,
): string | undefined {
  const fromResolution =
    proposal.merchantResolution && "rawLabel" in proposal.merchantResolution
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

  const top = topSuggestedMerchantCandidate(resolution);
  return top && hasMerchantCatalogData(top) ? top : undefined;
}

function topSuggestedMerchantCandidate(
  resolution: MerchantResolution | undefined,
): MerchantCandidate | undefined {
  if (resolution?.status !== "suggested") return undefined;
  return [...resolution.candidates].sort(
    (left, right) => (right.rawScore ?? 0) - (left.rawScore ?? 0),
  )[0];
}

/**
 * Select a candidate that is safe to confirm during AI enrichment. It must
 * clear the shared automatic threshold and have a syntactically valid domain.
 */
export function candidateForMerchantAutoConfirm(
  resolution: MerchantResolution | undefined,
): MerchantCandidate | undefined {
  const candidate = topSuggestedMerchantCandidate(resolution);
  if (!candidate || !isValidDomain(candidate.domain)) return undefined;
  return (candidate.rawScore ?? 0) >= MERCHANT_AUTO_CONFIRM_SCORE_THRESHOLD
    ? candidate
    : undefined;
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

async function persistMerchantCandidate(
  merchants: FilesystemMerchantStore,
  projectId: string,
  sourceId: string,
  rawLabel: string,
  candidate: MerchantCandidate,
  explanation: string,
): Promise<MerchantResolution> {
  let targetMerchantId: string | undefined;
  if (candidate.domain) {
    const byDomain = await merchants.findByDomain(projectId, candidate.domain);
    if (byDomain) targetMerchantId = byDomain.merchantId;
  }

  const merchant = await merchants.confirm(projectId, {
    sourceId,
    rawLabel,
    candidate,
    targetMerchantId,
  });
  return confirmedResolution(rawLabel, merchant, explanation);
}

/**
 * Confirm a high-confidence, domain-backed candidate as soon as AI enrichment
 * has resolved it. Other resolutions remain available for manual review.
 */
export async function autoConfirmMerchantResolution(
  merchants: FilesystemMerchantStore,
  projectId: string,
  sourceId: string,
  resolution: MerchantResolution,
): Promise<MerchantResolution> {
  if (resolution.status !== "suggested") return resolution;
  const candidate = candidateForMerchantAutoConfirm(resolution);
  if (!candidate) return resolution;

  const existing = await merchants.resolve(
    projectId,
    sourceId,
    resolution.rawLabel,
  );
  if (existing?.status === "confirmed" || existing?.status === "suppressed")
    return existing;

  return persistMerchantCandidate(
    merchants,
    projectId,
    sourceId,
    resolution.rawLabel,
    candidate,
    `Auto-confirmed merchant ${candidate.canonicalName} from a high-confidence domain-backed AI suggestion.`,
  );
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

  return {
    ...proposal,
    merchantResolution: await persistMerchantCandidate(
      merchants,
      projectId,
      sourceId,
      label,
      candidate,
      `Auto-persisted merchant ${candidate.canonicalName}.`,
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
    if (key && persisted.merchantResolution?.status === "confirmed") {
      byLabel.set(key, persisted.merchantResolution);
    }
    next.push(persisted);
  }

  return next;
}
