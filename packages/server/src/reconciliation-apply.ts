import { loadProjectSources, Transaction } from "@beancount-js/beancount";
import {
  proposalTransaction,
  transferTransaction,
  type ImportProposal,
  type IngestionRun,
} from "@beancount-js/beangulp";
import type { FilesystemWorkspaceAdapter } from "./workspace-adapter";
import type { FilesystemIngestionStore } from "./ingestion";
import type { FilesystemReconciliationStore } from "./reconciliation";
import {
  buildReconciliationReview,
  type ReconciliationReviewItem,
} from "./reconciliation";

type FileEdit = {
  path: string;
  from: number;
  to: number;
  original: string;
  next: string;
};

function errorMessages(errors: readonly { message: string }[]) {
  return new Set(errors.map((error) => error.message));
}

function sourceConnectionId(sourceId: string) {
  return sourceId.split(":", 1)[0] ?? sourceId;
}

function proposalRows(
  item: ReconciliationReviewItem,
  runs: readonly IngestionRun[],
) {
  const byRun = new Map(runs.map((run) => [run.id, run]));
  return item.members.flatMap((member) => {
    if (!member.proposal) return [];
    const proposal = byRun
      .get(member.proposal.runId)
      ?.proposals.find((entry) => entry.id === member.proposal?.proposalId);
    return proposal
      ? [
          {
            runId: member.proposal.runId,
            proposal,
            observationId: member.observation.id,
          },
        ]
      : [];
  });
}

function nextAlternatePrefix(metadata: Record<string, unknown>) {
  const indexes = Object.keys(metadata)
    .map((key) => /^import_alt_(\d+)_id$/.exec(key)?.[1])
    .filter((value): value is string => Boolean(value))
    .map(Number);
  return `import_alt_${Math.max(0, ...indexes) + 1}`;
}

function withLedgerProvenance(
  entry: Transaction,
  postingIndex: number,
  proposal: ImportProposal,
) {
  const transaction = proposal.transaction;
  if (!transaction)
    throw new Error("Proposal is missing its normalized transaction.");
  const posting = entry.postings[postingIndex];
  if (!posting) throw new Error("Ledger posting no longer exists.");
  const allMetadata = { ...entry.meta, ...posting.meta };
  const knownIds = Object.entries(allMetadata)
    .filter(
      ([key, value]) =>
        (key === "import_id" || /^import_alt_\d+_id$/.test(key)) &&
        typeof value === "string",
    )
    .map(([, value]) => value as string);
  if (knownIds.includes(proposal.importId)) return entry;
  const prefix = nextAlternatePrefix(allMetadata);
  const updatedPosting = posting.copy({
    meta: {
      ...posting.meta,
      [`${prefix}_id`]: proposal.importId,
      [`${prefix}_source`]: transaction.sourceId,
      [`${prefix}_fetched_at`]: transaction.fetchedAt,
    },
  });
  const postings = [...entry.postings];
  postings[postingIndex] = updatedPosting;
  return entry.copy({ postings });
}

function appendDirective(contents: string, directive: Transaction) {
  return `${contents.trimEnd()}\n\n${directive.toString().trim()}\n`;
}

function makeLedgerEdits(options: {
  item: ReconciliationReviewItem;
  entries: readonly unknown[];
  proposals: readonly { proposal: ImportProposal }[];
}) {
  const proposal = options.proposals[0]?.proposal;
  if (!proposal) return [];
  const edits: FileEdit[] = [];
  for (const member of options.item.members) {
    if (!member.ledger) continue;
    const entry = options.entries.find(
      (value): value is Transaction =>
        value instanceof Transaction &&
        value.meta.filename === member.ledger?.path &&
        value.meta.lineno === member.ledger?.line,
    );
    if (!entry)
      throw new Error("The matched ledger transaction is no longer available.");
    const updated = withLedgerProvenance(
      entry,
      member.ledger.postingIndex,
      proposal,
    );
    if (updated === entry) continue;
    const source = entry.source;
    if (!source)
      throw new Error("The matched ledger transaction has no source span.");
    edits.push({
      path: member.ledger.path,
      from: source.position.from,
      to: source.position.to,
      original: source.content,
      next: updated.toString().trimEnd() + "\n",
    });
  }
  return edits;
}

/**
 * Apply one confirmed decision. This is deliberately candidate-scoped: the
 * caller must review the exact result immediately before making any ledger
 * change, and no heuristic can silently reach this path.
 */
export async function applyReconciliation(options: {
  projectId: string;
  candidateId: string;
  ingestionStore: FilesystemIngestionStore;
  reconciliationStore: FilesystemReconciliationStore;
  workspace: FilesystemWorkspaceAdapter;
}) {
  let snapshot = await options.workspace.readProject(options.projectId);
  const [entries, previousErrors] = loadProjectSources(
    snapshot.project.entryFile,
    snapshot.ledgerFiles.map((file) => ({
      path: file.path,
      contents: file.contents,
    })),
  );
  const [config, runs, decisions] = await Promise.all([
    options.ingestionStore.readConfig(options.projectId),
    options.ingestionStore.readRuns(options.projectId),
    options.reconciliationStore.read(options.projectId),
  ]);
  const review = buildReconciliationReview({
    config,
    runs,
    entries,
    decisions,
  });
  const item = review.candidates.find(
    (candidate) => candidate.candidate.id === options.candidateId,
  );
  if (!item)
    throw new Error("That reconciliation candidate is no longer current.");
  if (item.decision?.state !== "confirmed") {
    throw new Error("Confirm this reconciliation before applying it.");
  }
  const proposalRowsForCandidate = proposalRows(item, runs);
  if (!proposalRowsForCandidate.length) {
    throw new Error("This candidate no longer has pending import proposals.");
  }
  const canonicalObservationId =
    item.decision.canonicalObservationId ??
    item.candidate.recommendedCanonicalId;
  const canonical = proposalRowsForCandidate.find(
    (row) => row.observationId === canonicalObservationId,
  );

  const changed = new Map<string, string>();
  let destinationPath: string | undefined;
  if (item.members.some((member) => member.ledger)) {
    for (const edit of makeLedgerEdits({
      item,
      entries,
      proposals: proposalRowsForCandidate,
    })) {
      const original =
        changed.get(edit.path) ??
        snapshot.ledgerFiles.find((file) => file.path === edit.path)?.contents;
      if (original === undefined)
        throw new Error(`Missing ledger file ${edit.path}.`);
      if (original.slice(edit.from, edit.to) !== edit.original) {
        throw new Error(
          "Ledger changed while applying reconciliation; reload and retry.",
        );
      }
      changed.set(
        edit.path,
        `${original.slice(0, edit.from)}${edit.next}${original.slice(edit.to)}`,
      );
      destinationPath ??= edit.path;
    }
  } else if (item.candidate.kind === "overlap") {
    if (!canonical?.proposal.selectedAccount) {
      throw new Error(
        "Choose a category on the canonical record before applying this overlap.",
      );
    }
    const source = config.sources.find(
      (entry) =>
        entry.id ===
        sourceConnectionId(canonical.proposal.transaction!.sourceId),
    );
    destinationPath = source?.destinationPath ?? snapshot.project.entryFile;
    const destination = snapshot.ledgerFiles.find(
      (file) => file.path === destinationPath,
    );
    if (!destination)
      throw new Error(
        "The configured import destination is not a ledger file.",
      );
    changed.set(
      destinationPath,
      appendDirective(
        destination.contents,
        proposalTransaction(
          canonical.proposal,
          canonical.proposal.selectedAccount,
          {
            alternates: proposalRowsForCandidate
              .filter((row) => row !== canonical)
              .map((row) => row.proposal),
          },
        ),
      ),
    );
  } else if (item.candidate.kind === "transfer") {
    if (proposalRowsForCandidate.length !== 2) {
      throw new Error("Transfers need exactly two pending account legs.");
    }
    const source = config.sources.find(
      (entry) =>
        entry.id ===
        sourceConnectionId(
          (canonical ?? proposalRowsForCandidate[0]!).proposal.transaction!
            .sourceId,
        ),
    );
    destinationPath = source?.destinationPath ?? snapshot.project.entryFile;
    const destination = snapshot.ledgerFiles.find(
      (file) => file.path === destinationPath,
    );
    if (!destination)
      throw new Error(
        "The configured import destination is not a ledger file.",
      );
    changed.set(
      destinationPath,
      appendDirective(
        destination.contents,
        transferTransaction(
          proposalRowsForCandidate[0]!.proposal,
          proposalRowsForCandidate[1]!.proposal,
        ),
      ),
    );
  } else {
    throw new Error(
      "This candidate needs a ledger record or a supported reconciliation kind.",
    );
  }

  if (!changed.size || !destinationPath) {
    throw new Error(
      "This reconciliation did not produce a safe ledger change.",
    );
  }
  const nextFiles = snapshot.ledgerFiles.map((file) =>
    changed.has(file.path)
      ? { ...file, contents: changed.get(file.path)! }
      : file,
  );
  const [, nextErrors] = loadProjectSources(
    snapshot.project.entryFile,
    nextFiles.map((file) => ({ path: file.path, contents: file.contents })),
  );
  const knownErrors = errorMessages(previousErrors);
  const introduced = nextErrors.filter(
    (error) => !knownErrors.has(error.message),
  );
  if (introduced.length) {
    throw new Error(
      `Reconciliation would introduce ledger errors: ${introduced.map((error) => error.message).join("; ")}`,
    );
  }

  let lastRevision = "";
  for (const [path, contents] of changed) {
    const revision = snapshot.revisions.find(
      (item) => item.path === path,
    )?.revision;
    if (!revision) throw new Error(`Missing ledger revision for ${path}.`);
    const written = await options.workspace.writeFile(
      options.projectId,
      { path, contents },
      { expectedRevision: revision },
    );
    lastRevision = written.revision;
  }
  const acceptedAt = new Date().toISOString();
  const byRun = new Map<string, ImportProposal[]>();
  for (const row of proposalRowsForCandidate) {
    const proposals = byRun.get(row.runId) ?? [];
    proposals.push(row.proposal);
    byRun.set(row.runId, proposals);
  }
  for (const [runId, proposals] of byRun) {
    await options.ingestionStore.markAccepted(
      options.projectId,
      runId,
      proposals,
      {
        acceptedAt,
        destinationPath,
        ledgerRevision: lastRevision,
      },
    );
  }
  snapshot = await options.workspace.readProject(options.projectId);
  return { snapshot, candidateId: item.candidate.id };
}
