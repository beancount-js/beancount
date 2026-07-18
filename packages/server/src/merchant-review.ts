import {
  normalizeMerchant,
  type ImportProposal,
  type IngestionRun,
  type MerchantCandidate,
  type MerchantResolution,
} from "@beancount-js/beangulp";
import { createHash } from "node:crypto";

export type MerchantReviewProposalRef = {
  runId: string;
  proposalId: string;
};

export type MerchantReviewMember = {
  rawLabel: string;
  normalizedLabel: string;
  count: number;
  refs: MerchantReviewProposalRef[];
};

export type MerchantReviewTransaction = {
  runId: string;
  proposalId: string;
  bookedAt: string;
  amount: string;
  currency: string;
  payee?: string;
  narration: string;
  rawLabel: string;
  sourceAccount: string;
  proposalStatus: ImportProposal["status"];
};

export type MerchantReviewCluster = {
  id: string;
  displayName: string;
  domain?: string;
  /** Best available logo from a suggested candidate or confirmed merchant. */
  logoUrl?: string;
  statuses: Array<MerchantResolution["status"]>;
  pendingCount: number;
  members: MerchantReviewMember[];
  candidates: MerchantCandidate[];
  /** Matching pending proposals for sheet context. */
  transactions: MerchantReviewTransaction[];
  explanation?: string;
  /** Representative proposal used for merchant actions. */
  primary: MerchantReviewProposalRef;
};

export type MerchantReviewProposalRow = {
  runId: string;
  proposal: ImportProposal;
};

export type MerchantReviewMode = "pending" | "reviewed";

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

export function runBelongsToConnection(
  runSourceId: string,
  connectionId: string,
) {
  return (
    runSourceId === connectionId || runSourceId.startsWith(`${connectionId}:`)
  );
}

export function rawMerchantLabel(proposal: ImportProposal) {
  const fromResolution = proposal.merchantResolution?.rawLabel?.trim();
  if (fromResolution) return fromResolution;
  const transaction = proposal.transaction;
  if (!transaction) return undefined;
  return (
    transaction.merchant?.trim() ||
    transaction.payee?.trim() ||
    transaction.narration?.trim() ||
    undefined
  );
}

/** UI "accepted" rows on Review imports (`ready` + selected account). */
export function isUiAcceptedProposal(proposal: ImportProposal) {
  return proposal.status === "ready" && Boolean(proposal.selectedAccount);
}

export function needsMerchantReview(proposal: ImportProposal) {
  if (!proposal.transaction) return false;
  if (
    proposal.status === "duplicate" ||
    proposal.status === "invalid" ||
    proposal.status === "accepted"
  ) {
    return false;
  }
  if (isUiAcceptedProposal(proposal)) return false;
  const status = proposal.merchantResolution?.status;
  return (
    status === "suggested" ||
    status === "unresolved" ||
    status === "suppressed" ||
    status === undefined
  );
}

/**
 * Merchant-bearing proposals that have already progressed beyond merchant
 * review. This includes confirmed merchants and proposal rows accepted in the
 * import review, while excluding duplicates and invalid imports.
 */
export function isReviewedMerchantProposal(proposal: ImportProposal) {
  if (!proposal.transaction) return false;
  if (proposal.status === "duplicate" || proposal.status === "invalid") {
    return false;
  }
  return !needsMerchantReview(proposal);
}

function primaryToken(normalized: string) {
  const token = normalized.split(/\s+/).find((part) => part.length >= 4);
  return token ?? normalized;
}

function candidateDomain(resolution: MerchantResolution | undefined) {
  if (!resolution) return undefined;
  if (resolution.status === "confirmed") {
    return resolution.merchant.domain?.trim().toLowerCase() || undefined;
  }
  if (resolution.status === "suggested") {
    for (const candidate of resolution.candidates) {
      const domain = candidate.domain?.trim().toLowerCase();
      if (domain) return domain;
    }
  }
  return undefined;
}

function rowClusterHints(row: MerchantReviewProposalRow) {
  const label = rawMerchantLabel(row.proposal);
  const normalized = normalizeMerchant(label);
  const domain = candidateDomain(row.proposal.merchantResolution);
  const token = normalized ? primaryToken(normalized) : undefined;
  return { normalized, domain, token };
}

function reviewableCount(run: IngestionRun) {
  return run.proposals.filter(
    (proposal) =>
      proposal.status === "ready" ||
      proposal.status === "needs-review" ||
      proposal.status === "held",
  ).length;
}

/** Same active-run pick as Review imports for a connection. */
export function pickActiveRunsForConnection(
  runs: readonly IngestionRun[],
  connectionId: string,
  options?: {
    preferredRunId?: string;
    syncRunIds?: readonly string[];
  },
) {
  const belonging = runs.filter((run) =>
    runBelongsToConnection(run.sourceId, connectionId),
  );
  if (!belonging.length) return [] as IngestionRun[];

  if (options?.preferredRunId) {
    const preferred = belonging.find(
      (run) => run.id === options.preferredRunId,
    );
    if (preferred) return [preferred];
  }

  if (options?.syncRunIds?.length) {
    const fromSync = options.syncRunIds
      .map((runId) => belonging.find((run) => run.id === runId))
      .filter((run): run is IngestionRun => Boolean(run));
    if (fromSync.length) return fromSync;
  }

  const sorted = [...belonging].sort((left, right) =>
    (right.completedAt || right.startedAt).localeCompare(
      left.completedAt || left.startedAt,
    ),
  );
  const reviewable = sorted.find((run) => reviewableCount(run) > 0);
  return reviewable ? [reviewable] : sorted[0] ? [sorted[0]] : [];
}

export function clusterMerchantReviewProposals(
  rows: readonly MerchantReviewProposalRow[],
  mode: MerchantReviewMode = "pending",
): MerchantReviewCluster[] {
  const eligible = rows.filter((row) =>
    mode === "pending"
      ? needsMerchantReview(row.proposal)
      : isReviewedMerchantProposal(row.proposal),
  );
  // Union-find style merge: share domain or primary token (≥4 chars).
  const parent = new Map<number, number>();
  const find = (index: number): number => {
    let current = index;
    while (parent.get(current) !== current) {
      const next = parent.get(current) ?? current;
      parent.set(current, parent.get(next) ?? next);
      current = next;
    }
    return current;
  };
  const union = (left: number, right: number) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(a, b);
  };
  for (let i = 0; i < eligible.length; i += 1) parent.set(i, i);
  const byDomain = new Map<string, number>();
  const byToken = new Map<string, number>();
  eligible.forEach((row, index) => {
    const hints = rowClusterHints(row);
    if (hints.domain) {
      const existing = byDomain.get(hints.domain);
      if (existing !== undefined) union(index, existing);
      else byDomain.set(hints.domain, index);
    }
    if (hints.token) {
      const existing = byToken.get(hints.token);
      if (existing !== undefined) union(index, existing);
      else byToken.set(hints.token, index);
    }
  });
  const buckets = new Map<number, MerchantReviewProposalRow[]>();
  eligible.forEach((row, index) => {
    const root = find(index);
    const list = buckets.get(root) ?? [];
    list.push(row);
    buckets.set(root, list);
  });

  const clusters: MerchantReviewCluster[] = [];
  for (const [, members] of buckets) {
    const mergeKey = members
      .map((row) => {
        const hints = rowClusterHints(row);
        return hints.domain
          ? `domain:${hints.domain}`
          : `token:${hints.token ?? row.proposal.id}`;
      })
      .sort()
      .join("|");
    const labels = new Map<string, MerchantReviewMember>();
    const statuses = new Set<MerchantResolution["status"]>();
    const candidatesById = new Map<string, MerchantCandidate>();
    const transactions: MerchantReviewTransaction[] = [];
    let domain: string | undefined;
    let explanation: string | undefined;
    let displayName = "";
    let logoUrl: string | undefined;

    for (const row of members) {
      const label = rawMerchantLabel(row.proposal) ?? "(unknown)";
      const normalized = normalizeMerchant(label);
      const existing = labels.get(normalized) ?? {
        rawLabel: label,
        normalizedLabel: normalized,
        count: 0,
        refs: [],
      };
      existing.count += 1;
      existing.refs.push({
        runId: row.runId,
        proposalId: row.proposal.id,
      });
      labels.set(normalized, existing);

      const tx = row.proposal.transaction;
      if (tx) {
        transactions.push({
          runId: row.runId,
          proposalId: row.proposal.id,
          bookedAt: tx.bookedAt,
          amount: tx.amount,
          currency: tx.currency,
          payee: tx.payee,
          narration: tx.narration,
          rawLabel: label,
          sourceAccount: tx.sourceAccount,
          proposalStatus: row.proposal.status,
        });
      }

      const resolution = row.proposal.merchantResolution;
      if (resolution?.status) statuses.add(resolution.status);
      else statuses.add("unresolved");
      domain ??= candidateDomain(resolution);
      if (resolution?.status === "suggested") {
        for (const candidate of resolution.candidates) {
          candidatesById.set(candidate.id, candidate);
          logoUrl ??= candidate.logoUrl;
        }
        explanation ??= resolution.explanation;
        displayName ||= resolution.candidates[0]?.canonicalName ?? label;
      } else if (resolution?.status === "confirmed") {
        displayName ||= resolution.merchant.canonicalName;
        explanation ??= resolution.explanation;
        logoUrl ??= resolution.merchant.logoUrl;
      } else {
        displayName ||= label;
        explanation ??= resolution?.explanation;
      }
    }

    const memberList = [...labels.values()].sort(
      (left, right) =>
        right.count - left.count || left.rawLabel.localeCompare(right.rawLabel),
    );
    const primaryMember = memberList[0]!;
    const primary = primaryMember.refs[0]!;
    transactions.sort(
      (left, right) =>
        right.bookedAt.localeCompare(left.bookedAt) ||
        right.amount.localeCompare(left.amount),
    );
    clusters.push({
      id: md5(mergeKey),
      displayName: displayName || primaryMember.rawLabel,
      domain,
      logoUrl,
      statuses: [...statuses],
      pendingCount: members.length,
      members: memberList,
      candidates: [...candidatesById.values()],
      transactions,
      explanation,
      primary,
    });
  }

  return clusters.sort(
    (left, right) =>
      right.pendingCount - left.pendingCount ||
      left.displayName.localeCompare(right.displayName),
  );
}

export function buildMerchantReviewClusters(
  runs: readonly IngestionRun[],
  connectionId: string,
  options?: {
    preferredRunId?: string;
    syncRunIds?: readonly string[];
    mode?: MerchantReviewMode;
  },
) {
  const active = pickActiveRunsForConnection(runs, connectionId, options);
  const rows = active.flatMap((run) =>
    run.proposals.map((proposal) => ({ runId: run.id, proposal })),
  );
  return {
    runIds: active.map((run) => run.id),
    clusters: clusterMerchantReviewProposals(rows, options?.mode),
  };
}

function stripMerchantIssues(issues: readonly string[]) {
  return issues.filter(
    (issue) =>
      !issue.startsWith("Merchant resolver ") &&
      !issue.startsWith("AI merchant advisor "),
  );
}

/**
 * Apply a merchant resolution to pending (non-accepted) proposals that share
 * the given normalized labels. Does not change status / selectedAccount /
 * suggestions.
 */
export function applyMerchantResolutionToPendingProposals(
  runs: readonly IngestionRun[],
  connectionId: string,
  normalizedLabels: ReadonlySet<string>,
  merchantResolution: MerchantResolution,
  options?: { includeSuppressed?: boolean },
) {
  const updatedRuns: IngestionRun[] = [];
  let updatedCount = 0;

  for (const run of runs) {
    if (!runBelongsToConnection(run.sourceId, connectionId)) {
      updatedRuns.push(run);
      continue;
    }
    let changed = false;
    const proposals = run.proposals.map((proposal) => {
      if (!proposal.transaction) return proposal;
      if (
        proposal.status === "duplicate" ||
        proposal.status === "invalid" ||
        proposal.status === "accepted"
      ) {
        return proposal;
      }
      if (isUiAcceptedProposal(proposal)) return proposal;
      const label = rawMerchantLabel(proposal);
      if (!label) return proposal;
      if (!normalizedLabels.has(normalizeMerchant(label))) return proposal;
      const status = proposal.merchantResolution?.status;
      if (status === "suppressed" && !options?.includeSuppressed) {
        return proposal;
      }
      if (
        status === "confirmed" &&
        merchantResolution.status === "confirmed" &&
        proposal.merchantResolution?.status === "confirmed" &&
        proposal.merchantResolution.merchant.merchantId ===
          merchantResolution.merchant.merchantId
      ) {
        return proposal;
      }
      changed = true;
      updatedCount += 1;
      return {
        ...proposal,
        merchantResolution: {
          ...merchantResolution,
          rawLabel:
            merchantResolution.status === "unresolved"
              ? label
              : (merchantResolution.rawLabel ?? label),
        },
        issues: stripMerchantIssues(proposal.issues ?? []),
      } satisfies ImportProposal;
    });
    updatedRuns.push(
      changed
        ? {
            ...run,
            proposals,
          }
        : run,
    );
  }

  return { runs: updatedRuns, updatedCount };
}
