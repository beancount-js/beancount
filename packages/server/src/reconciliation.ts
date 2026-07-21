import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { Transaction, type Directive } from "@beancount-js/beancount";
import {
  findReconciliationCandidates,
  type ImportProposal,
  type IngestionRun,
  type ReconciliationCandidate,
  type ReconciliationObservation,
} from "@beancount-js/beangulp";
import type { ProjectRootResolver } from "./merchant";
import { projectIngestionRoot } from "./paths";
import type { IngestionConfig, IngestionSourceDefinition } from "./ingestion";

export type ReconciliationDecisionState = "confirmed" | "dismissed";

/** A reviewer choice; applying it remains a separate, explicit write step. */
export interface ReconciliationDecision {
  candidateId: string;
  state: ReconciliationDecisionState;
  /** Required for confirmed cross-source overlaps where there is no default. */
  canonicalObservationId?: string;
  updatedAt: string;
}

export interface ReconciliationProposalRef {
  runId: string;
  proposalId: string;
}

export interface ReconciliationLedgerRef {
  path: string;
  line: number;
  postingIndex: number;
}

export interface ReconciliationReviewMember {
  observation: ReconciliationObservation;
  proposal?: ReconciliationProposalRef;
  ledger?: ReconciliationLedgerRef;
}

export interface ReconciliationReviewItem {
  candidate: ReconciliationCandidate;
  members: ReconciliationReviewMember[];
  decision?: ReconciliationDecision;
}

export interface ReconciliationReview {
  candidates: ReconciliationReviewItem[];
  observations: ReconciliationReviewMember[];
}

/** A confirmed reconciliation attached to one pending import proposal. */
export interface ConfirmedProposalReconciliation {
  runId: string;
  proposalId: string;
  candidateId: string;
  kind: ReconciliationCandidate["kind"];
  canonicalObservationId?: string;
}

type PersistedDecisions = {
  version: 1;
  decisions: ReconciliationDecision[];
};

function sourceConnectionId(sourceId: string) {
  return sourceId.split(":", 1)[0] ?? sourceId;
}

function isBalanceSheetAccount(account: string) {
  return account.startsWith("Assets:") || account.startsWith("Liabilities:");
}

function asString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function providerImportId(provider: string | undefined, value: unknown) {
  if (!provider || provider === "json-api" || typeof value !== "string") {
    return undefined;
  }
  return `${provider.toLowerCase()}:${value}`;
}

function importIds(metadata: Record<string, unknown>, provider?: string) {
  const ids = Object.entries(metadata)
    .filter(
      ([key, value]) =>
        (key === "import_id" || /^import_alt_\d+_id$/.test(key)) &&
        typeof value === "string",
    )
    .map(([, value]) => value as string);
  for (const [key, value] of Object.entries(metadata)) {
    if (
      key === "import_provider_id" ||
      /^import_alt_\d+_provider_id$/.test(key)
    ) {
      const providerId = providerImportId(provider, value);
      if (providerId) ids.push(providerId);
    }
  }
  return ids;
}

function sourcePriority(
  source: IngestionSourceDefinition | undefined,
  runSourceId: string,
) {
  if (!source) return 0;
  const targetId = runSourceId.slice(source.id.length + 1);
  const account = source.accounts?.find((item) => item.id === targetId);
  return account?.reconciliationPriority ?? source.reconciliationPriority ?? 0;
}

function proposalMember(
  run: IngestionRun,
  proposal: ImportProposal,
  source: IngestionSourceDefinition | undefined,
): ReconciliationReviewMember | undefined {
  const transaction = proposal.transaction;
  if (!transaction) return undefined;
  return {
    observation: {
      id: `proposal:${run.id}:${proposal.id}`,
      origin: "proposal",
      sourceId: transaction.sourceId,
      sourceAccount: transaction.sourceAccount,
      bookedAt: transaction.bookedAt,
      amount: transaction.amount,
      currency: transaction.currency,
      merchant: transaction.merchant,
      payee: transaction.payee,
      narration: transaction.narration,
      status: transaction.status,
      importIds: [
        proposal.importId,
        ...importIds(
          { import_provider_id: transaction.externalId },
          source?.kind,
        ),
      ],
      rawFingerprint: transaction.metadata.raw_fingerprint,
      priority: sourcePriority(source, run.sourceId),
      transferEvidence: transaction.transferEvidence,
      transaction,
    },
    proposal: { runId: run.id, proposalId: proposal.id },
  };
}

function ledgerMembers(
  entries: readonly Directive[],
  config: IngestionConfig,
): ReconciliationReviewMember[] {
  const result: ReconciliationReviewMember[] = [];
  for (const entry of entries) {
    if (!(entry instanceof Transaction)) continue;
    const filename = asString(entry.meta.filename);
    const lineno = entry.meta.lineno;
    if (!filename || typeof lineno !== "number") continue;
    for (const [postingIndex, posting] of entry.postings.entries()) {
      if (
        !posting.units ||
        !posting.units.currency ||
        !isBalanceSheetAccount(posting.account)
      )
        continue;
      const metadata = { ...entry.meta, ...posting.meta };
      const sourceId = asString(metadata.import_source);
      const source = sourceId
        ? config.sources.find(
            (item) => item.id === sourceConnectionId(sourceId),
          )
        : undefined;
      result.push({
        observation: {
          id: `ledger:${filename}:${lineno}:${postingIndex}`,
          origin: "ledger",
          sourceId,
          sourceAccount: posting.account,
          bookedAt: entry.date.toISODate() ?? "",
          amount: posting.units.number.toString(),
          currency: posting.units.currency,
          merchant: asString(metadata.merchant_raw),
          payee: entry.payee || undefined,
          narration: entry.narration,
          importIds: importIds(metadata, source?.kind),
          rawFingerprint: asString(metadata.raw_fingerprint),
          // Preserve ledger descriptions and user changes by default.
          priority: 1_000,
        },
        ledger: { path: filename, line: lineno, postingIndex },
      });
    }
  }
  return result;
}

function reviewable(proposal: ImportProposal) {
  return (
    proposal.status === "ready" ||
    proposal.status === "needs-review" ||
    proposal.status === "held"
  );
}

/**
 * Composes every outstanding run with the parsed ledger; selection is global
 * so collisions between independent connections stay visible together.
 */
export function buildReconciliationReview(options: {
  config: IngestionConfig;
  runs: readonly IngestionRun[];
  entries: readonly Directive[];
  decisions?: readonly ReconciliationDecision[];
}): ReconciliationReview {
  const sources = new Map(
    options.config.sources.map((source) => [source.id, source]),
  );
  const observations: ReconciliationReviewMember[] = [];
  for (const run of options.runs) {
    const source = sources.get(sourceConnectionId(run.sourceId));
    for (const proposal of run.proposals) {
      if (!reviewable(proposal)) continue;
      const member = proposalMember(run, proposal, source);
      if (member) observations.push(member);
    }
  }
  observations.push(...ledgerMembers(options.entries, options.config));

  const dismissedCandidateIds = new Set(
    options.decisions
      ?.filter((decision) => decision.state === "dismissed")
      .map((decision) => decision.candidateId),
  );
  const transferAccounts = new Set<string>();
  for (const source of options.config.sources) {
    if (source.sourceAccount) transferAccounts.add(source.sourceAccount);
    source.accounts?.forEach((account) =>
      transferAccounts.add(account.sourceAccount),
    );
  }
  observations
    .filter((member) => member.observation.origin === "ledger")
    .filter((member) => isBalanceSheetAccount(member.observation.sourceAccount))
    .forEach((member) =>
      transferAccounts.add(member.observation.sourceAccount),
    );

  const result = findReconciliationCandidates(
    observations.map((member) => member.observation),
    {
      ...options.config.reconciliation,
      transferAccounts,
      dismissedCandidateIds,
    },
  );
  const byId = new Map(
    observations.map((member) => [member.observation.id, member]),
  );
  const decisions = new Map(
    options.decisions?.map((decision) => [decision.candidateId, decision]),
  );
  return {
    observations,
    candidates: result.candidates.map((candidate) => ({
      candidate,
      members: candidate.memberIds
        .map((memberId) => byId.get(memberId))
        .filter((member): member is ReconciliationReviewMember =>
          Boolean(member),
        ),
      decision: decisions.get(candidate.id),
    })),
  };
}

/**
 * Find the deterministic subset of outstanding overlaps that can safely use
 * their configured source priority as the canonical side. Applying remains a
 * separate reviewer action.
 */
export function autoConfirmableMappedOverlaps(
  review: ReconciliationReview,
): ReconciliationReviewItem[] {
  const membershipCount = new Map<string, number>();
  for (const item of review.candidates) {
    for (const memberId of item.candidate.memberIds) {
      membershipCount.set(memberId, (membershipCount.get(memberId) ?? 0) + 1);
    }
  }

  return review.candidates.filter((item) => {
    if (
      item.candidate.kind !== "overlap" ||
      item.decision ||
      !item.candidate.recommendedCanonicalId ||
      item.members.length !== 2
    ) {
      return false;
    }
    const [left, right] = item.members;
    if (!left || !right || !left.proposal || !right.proposal) return false;
    const leftObservation = left.observation;
    const rightObservation = right.observation;
    const leftConnection = sourceConnectionId(leftObservation.sourceId ?? "");
    const rightConnection = sourceConnectionId(rightObservation.sourceId ?? "");
    return (
      Boolean(leftConnection) &&
      Boolean(rightConnection) &&
      leftConnection !== rightConnection &&
      leftObservation.sourceAccount === rightObservation.sourceAccount &&
      leftObservation.currency === rightObservation.currency &&
      item.candidate.memberIds.every(
        (memberId) => membershipCount.get(memberId) === 1,
      )
    );
  });
}

/**
 * Project confirmed candidate decisions onto the proposal rows that remain in
 * ordinary review. A proposal can intentionally appear in more than one
 * manual decision, so callers must preserve every annotation.
 */
export function confirmedProposalReconciliations(
  review: ReconciliationReview,
): ConfirmedProposalReconciliation[] {
  return review.candidates.flatMap((item) => {
    const decision = item.decision;
    if (decision?.state !== "confirmed") return [];
    return item.members.flatMap((member) =>
      member.proposal
        ? [
            {
              ...member.proposal,
              candidateId: item.candidate.id,
              kind: item.candidate.kind,
              canonicalObservationId: decision.canonicalObservationId,
            },
          ]
        : [],
    );
  });
}

function projectId(value: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(value))
    throw new Error("Invalid project identifier.");
  return value;
}

function decisionPath(root: string) {
  return join(projectIngestionRoot(root), "reconciliation-decisions.json");
}

function checksum(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Persisted reviewer decisions intentionally separate from mutable run files. */
export class FilesystemReconciliationStore {
  constructor(private readonly resolveProjectRoot: ProjectRootResolver) {}

  private async path(project: string) {
    return decisionPath(await this.resolveProjectRoot(projectId(project)));
  }

  async read(project: string): Promise<ReconciliationDecision[]> {
    try {
      const raw = JSON.parse(
        await fs.readFile(await this.path(project), "utf8"),
      ) as Partial<PersistedDecisions>;
      return Array.isArray(raw.decisions)
        ? raw.decisions.filter(
            (item): item is ReconciliationDecision =>
              !!item &&
              typeof item.candidateId === "string" &&
              (item.state === "confirmed" || item.state === "dismissed") &&
              typeof item.updatedAt === "string",
          )
        : [];
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async save(project: string, decision: ReconciliationDecision) {
    const path = await this.path(project);
    const previous = await this.read(project);
    const decisions = [
      ...previous.filter((item) => item.candidateId !== decision.candidateId),
      decision,
    ].sort((left, right) => left.candidateId.localeCompare(right.candidateId));
    await this.write(path, decisions);
    return decision;
  }

  /** Remove a prior reviewer choice so a current candidate is visible again. */
  async remove(project: string, candidateId: string) {
    const path = await this.path(project);
    const previous = await this.read(project);
    const decisions = previous.filter(
      (decision) => decision.candidateId !== candidateId,
    );
    if (decisions.length === previous.length) return false;
    await this.write(path, decisions);
    return true;
  }

  private async write(path: string, decisions: ReconciliationDecision[]) {
    const payload: PersistedDecisions = { version: 1, decisions };
    const serialized = JSON.stringify(payload, null, 2) + "\n";
    await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = `${path}.${checksum(serialized).slice(0, 12)}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary, serialized, { mode: 0o600 });
    await fs.chmod(temporary, 0o600);
    await fs.rename(temporary, path);
  }
}
