import {
  applyRuleActions,
  ruleMatches,
  type DetectionRule,
  type ImportProposal,
  type IngestionRun,
  type NormalizedTransaction,
  type RuleApplyTarget,
  type RuleEvaluationContext,
  type RulePatch,
  type RuleRunTargetCounts,
} from "@beancount-js/beangulp";
import {
  loadProjectSources,
  Posting,
  Transaction,
  type Directive,
} from "@beancount-js/beancount";
import type { FilesystemIngestionStore } from "./ingestion";
import type { FilesystemRulesStore } from "./rules";
import type { FilesystemWorkspaceAdapter } from "./workspace-adapter";

export type RuleApplyMatchCounts = RuleRunTargetCounts & {
  total: number;
};

export type RuleApplyPreview = {
  ruleId: string;
  ruleName: string;
  target: RuleApplyTarget;
  pendingImports: number;
  liveLedger: number;
  total: number;
};

export type RuleApplyResult = {
  ruleId: string;
  ruleName: string;
  runId: string;
  status: "success" | "failed";
  queued: number;
  processed: number;
  modified: number;
  blocked: number;
  target: RuleApplyTarget;
  targetCounts: {
    queued: RuleRunTargetCounts;
    processed: RuleRunTargetCounts;
    modified: RuleRunTargetCounts;
  };
  errorMessage?: string | null;
};

function emptyTargetCounts(): RuleRunTargetCounts {
  return { pendingImports: 0, liveLedger: 0 };
}

function targetIncludesPendingImports(target: RuleApplyTarget) {
  return target === "pending-imports" || target === "both";
}

function targetIncludesLiveLedger(target: RuleApplyTarget) {
  return target === "live-ledger" || target === "both";
}

function countsForTarget(
  counts: RuleApplyMatchCounts,
  target: RuleApplyTarget,
): RuleApplyMatchCounts {
  const pendingImports = targetIncludesPendingImports(target)
    ? counts.pendingImports
    : 0;
  const liveLedger = targetIncludesLiveLedger(target)
    ? counts.liveLedger
    : 0;
  return { pendingImports, liveLedger, total: pendingImports + liveLedger };
}

function errorMessages(errors: readonly { message: string }[]) {
  return new Set(errors.map((error) => error.message));
}

function proposalContext(proposal: ImportProposal): RuleEvaluationContext | undefined {
  if (!proposal.transaction) return undefined;
  return {
    transaction: proposal.transaction,
    merchant:
      proposal.merchantResolution?.status === "confirmed"
        ? proposal.merchantResolution.merchant
        : undefined,
    bookedAt: proposal.transaction.bookedAt,
  };
}

function ledgerContext(entry: Transaction): RuleEvaluationContext | undefined {
  if (entry.postings.length < 2 || !entry.date) return undefined;
  const withUnits = entry.postings.filter((posting) => posting.units);
  if (withUnits.length === 0) return undefined;
  const source = withUnits[0];
  const category =
    entry.postings.find((posting) => posting !== source) ?? entry.postings[1];
  if (!source.units || !category) return undefined;
  const merchantRaw =
    typeof entry.meta.merchant_raw === "string"
      ? entry.meta.merchant_raw
      : undefined;
  const merchantId =
    typeof entry.meta.merchant_id === "string"
      ? entry.meta.merchant_id
      : undefined;
  const transaction: NormalizedTransaction = {
    sourceId: String(entry.meta.import_source ?? ""),
    sourceAccount: source.account,
    bookedAt: entry.date.toISODate() ?? "",
    amount: source.units.value.toString(),
    currency: String(source.units.currency ?? ""),
    merchant: merchantRaw ?? (entry.payee ? entry.payee : undefined),
    payee: entry.payee ? entry.payee : undefined,
    narration: entry.narration,
    status: "posted",
    fetchedAt: "",
    tags: [...entry.tags],
    links: [...entry.links],
    metadata: {},
  };
  return {
    transaction,
    merchant: merchantId
      ? {
          merchantId,
          canonicalName: entry.payee || merchantRaw || entry.narration,
          aliases: [] as const,
          provenance: [] as const,
        }
      : undefined,
    bookedAt: transaction.bookedAt,
  };
}

function applyPatchToProposal(
  proposal: ImportProposal,
  patch: RulePatch,
): ImportProposal {
  if (!proposal.transaction) return proposal;
  const transaction = { ...proposal.transaction };
  if (patch.narration !== undefined) transaction.narration = patch.narration;
  if (patch.merchant !== undefined) transaction.merchant = patch.merchant;
  if (patch.tags) transaction.tags = patch.tags;
  return {
    ...proposal,
    transaction,
    selectedAccount: patch.selectedAccount ?? proposal.selectedAccount,
    status: patch.exclude ? "excluded" : proposal.status,
  };
}

function applyPatchToLedger(
  entry: Transaction,
  patch: RulePatch,
  context: RuleEvaluationContext,
): Transaction | undefined {
  let payee = entry.payee;
  let narration = entry.narration;
  let tags = [...entry.tags];
  let postings = [...entry.postings];
  let meta = { ...entry.meta };
  let changed = false;

  if (patch.narration !== undefined && patch.narration !== narration) {
    narration = patch.narration;
    changed = true;
  }
  if (patch.merchant !== undefined && patch.merchant !== payee) {
    payee = patch.merchant;
    meta = { ...meta, merchant_raw: patch.merchant };
    changed = true;
  }
  if (patch.tags) {
    const next = [...new Set([...tags, ...patch.tags])];
    if (next.length !== tags.length || next.some((tag, i) => tag !== tags[i])) {
      tags = next;
      changed = true;
    }
  }
  if (patch.exclude && !tags.includes("excluded")) {
    tags = [...tags, "excluded"];
    meta = { ...meta, rule_excluded: true };
    changed = true;
  }
  if (patch.selectedAccount) {
    const sourceAccount = context.transaction.sourceAccount;
    const nextPostings = postings.map((posting) => {
      if (posting.account === sourceAccount) return posting;
      if (posting.account === patch.selectedAccount) return posting;
      // Prefer changing the non-source posting without units (category leg).
      if (!posting.units || posting.account !== sourceAccount) {
        changed = true;
        return new Posting(
          patch.selectedAccount!,
          posting.units,
          posting.cost,
          posting.price,
          posting.flag,
          posting.meta,
        );
      }
      return posting;
    });
    // If heuristic didn't change anything, force-update the last posting.
    if (
      !nextPostings.some(
        (posting, index) => posting.account !== postings[index]?.account,
      )
    ) {
      const index = postings.findIndex(
        (posting) => posting.account !== sourceAccount,
      );
      if (index >= 0 && postings[index].account !== patch.selectedAccount) {
        nextPostings[index] = new Posting(
          patch.selectedAccount,
          postings[index].units,
          postings[index].cost,
          postings[index].price,
          postings[index].flag,
          postings[index].meta,
        );
        changed = true;
      }
    }
    postings = nextPostings;
  }

  if (!changed) return undefined;
  return entry.copy({ payee, narration, tags, postings, meta });
}

function pendingProposals(runs: readonly IngestionRun[]) {
  return runs.flatMap((run) =>
    run.proposals
      .filter(
        (proposal) =>
          Boolean(proposal.transaction) &&
          (proposal.status === "ready" ||
            proposal.status === "needs-review" ||
            proposal.status === "held"),
      )
      .map((proposal) => ({ runId: run.id, proposal })),
  );
}

export function countRuleMatches(
  rule: DetectionRule,
  runs: readonly IngestionRun[],
  entries: readonly Directive[],
): RuleApplyMatchCounts {
  let pendingImports = 0;
  for (const { proposal } of pendingProposals(runs)) {
    const context = proposalContext(proposal);
    if (context && ruleMatches(rule, context)) pendingImports += 1;
  }
  let liveLedger = 0;
  for (const entry of entries) {
    if (!(entry instanceof Transaction)) continue;
    const context = ledgerContext(entry);
    if (context && ruleMatches(rule, context)) liveLedger += 1;
  }
  return {
    pendingImports,
    liveLedger,
    total: pendingImports + liveLedger,
  };
}

export async function previewRuleApply(options: {
  projectId: string;
  ruleIds?: string[];
  target: RuleApplyTarget;
  rulesStore: FilesystemRulesStore;
  ingestionStore: FilesystemIngestionStore;
  workspace: FilesystemWorkspaceAdapter;
}) {
  const file = await options.rulesStore.readRules(options.projectId);
  const selected = options.ruleIds?.length
    ? file.rules.filter((rule) => options.ruleIds!.includes(rule.id))
    : file.rules.filter((rule) => rule.active);
  const runs = await options.ingestionStore.readRuns(options.projectId);
  const snapshot = await options.workspace.readProject(options.projectId);
  const [entries] = loadProjectSources(
    snapshot.project.entryFile,
    snapshot.ledgerFiles.map((file) => ({
      path: file.path,
      contents: file.contents,
    })),
  );
  return selected.map((rule) => {
    const counts = countsForTarget(
      countRuleMatches(rule, runs, entries),
      options.target,
    );
    return {
      ruleId: rule.id,
      ruleName: rule.name ?? "Untitled rule",
      target: options.target,
      ...counts,
    } satisfies RuleApplyPreview;
  });
}

export async function applyDetectionRules(options: {
  projectId: string;
  ruleIds?: string[];
  target: RuleApplyTarget;
  rulesStore: FilesystemRulesStore;
  ingestionStore: FilesystemIngestionStore;
  workspace: FilesystemWorkspaceAdapter;
}): Promise<{ results: RuleApplyResult[]; snapshot: Awaited<ReturnType<FilesystemWorkspaceAdapter["readProject"]>> }> {
  const file = await options.rulesStore.readRules(options.projectId);
  const selected = options.ruleIds?.length
    ? file.rules.filter((rule) => options.ruleIds!.includes(rule.id))
    : file.rules.filter((rule) => rule.active);
  const results: RuleApplyResult[] = [];

  for (const rule of selected) {
    const preview = await previewRuleApply({
      ...options,
      ruleIds: [rule.id],
    });
    const queuedByTarget: RuleRunTargetCounts = {
      pendingImports: preview[0]?.pendingImports ?? 0,
      liveLedger: preview[0]?.liveLedger ?? 0,
    };
    const queued = queuedByTarget.pendingImports + queuedByTarget.liveLedger;
    const run = await options.rulesStore.startRun(options.projectId, {
      ruleId: rule.id,
      ruleName: rule.name ?? "Untitled rule",
      queued,
      target: options.target,
      targetCounts: {
        queued: queuedByTarget,
        processed: emptyTargetCounts(),
        modified: emptyTargetCounts(),
      },
    });
    const processedByTarget = emptyTargetCounts();
    const modifiedByTarget = emptyTargetCounts();

    try {
      const changedRuns: IngestionRun[] = [];
      let pendingModified = 0;
      if (targetIncludesPendingImports(options.target)) {
        const runs = await options.ingestionStore.readRuns(options.projectId);
        for (const ingestionRun of runs) {
          let runChanged = false;
          const proposals = ingestionRun.proposals.map((proposal) => {
            if (
              proposal.status !== "ready" &&
              proposal.status !== "needs-review" &&
              proposal.status !== "held"
            ) {
              return proposal;
            }
            const context = proposalContext(proposal);
            if (!context || !ruleMatches(rule, context)) return proposal;
            processedByTarget.pendingImports += 1;
            const patch = applyRuleActions(rule, context);
            if (!patch) return proposal;
            const next = applyPatchToProposal(proposal, patch);
            if (next !== proposal) {
              pendingModified += 1;
              runChanged = true;
            }
            return next;
          });
          if (runChanged) changedRuns.push({ ...ingestionRun, proposals });
        }
      }

      if (targetIncludesLiveLedger(options.target)) {
        const snapshot = await options.workspace.readProject(options.projectId);
        const [entries, previousErrors] = loadProjectSources(
          snapshot.project.entryFile,
          snapshot.ledgerFiles.map((ledgerFile) => ({
            path: ledgerFile.path,
            contents: ledgerFile.contents,
          })),
        );
        type Edit = {
          path: string;
          from: number;
          to: number;
          original: string;
          next: string;
        };
        const editsByPath = new Map<string, Edit[]>();

        for (const entry of entries) {
          if (!(entry instanceof Transaction)) continue;
          const context = ledgerContext(entry);
          if (!context || !ruleMatches(rule, context)) continue;
          processedByTarget.liveLedger += 1;
          const patch = applyRuleActions(rule, context);
          if (!patch) continue;
          const updated = applyPatchToLedger(entry, patch, context);
          if (!updated) continue;
          const source = entry.source;
          const path = String(entry.meta.filename ?? "");
          if (!source || !path) continue;
          const list = editsByPath.get(path) ?? [];
          list.push({
            path,
            from: source.position.from,
            to: source.position.to,
            original: source.content,
            next: updated.toString().trimEnd() + "\n",
          });
          editsByPath.set(path, list);
        }

        const contentsByPath = new Map<string, string>();
        for (const [path, edits] of editsByPath) {
          const fileEntry = snapshot.ledgerFiles.find((item) => item.path === path);
          const revision = snapshot.revisions.find(
            (item) => item.path === path,
          )?.revision;
          if (!fileEntry || !revision) {
            throw new Error(`Missing ledger file revision for ${path}.`);
          }
          let contents = fileEntry.contents;
          for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
            if (contents.slice(edit.from, edit.to) !== edit.original) {
              throw new Error(
                `Ledger changed while applying rules to ${path}; reload and retry.`,
              );
            }
            contents = `${contents.slice(0, edit.from)}${edit.next}${contents.slice(edit.to)}`;
          }
          contentsByPath.set(path, contents);
        }

        const sourceFiles = snapshot.ledgerFiles.map((item) => ({
          ...item,
          contents: contentsByPath.get(item.path) ?? item.contents,
        }));
        const [, nextErrors] = loadProjectSources(
          snapshot.project.entryFile,
          sourceFiles.map((item) => ({ path: item.path, contents: item.contents })),
        );
        const known = errorMessages(previousErrors);
        const introduced = nextErrors.filter(
          (error) => !known.has(error.message),
        );
        if (introduced.length) {
          throw new Error(
            `Applying rule would introduce ledger errors: ${introduced
              .map((error) => error.message)
              .join("; ")}`,
          );
        }

        for (const fileEntry of sourceFiles) {
          if (!contentsByPath.has(fileEntry.path)) continue;
          const revision = snapshot.revisions.find(
            (item) => item.path === fileEntry.path,
          )?.revision;
          if (!revision) {
            throw new Error(`Missing ledger file revision for ${fileEntry.path}.`);
          }
          await options.workspace.writeFile(
            options.projectId,
            { path: fileEntry.path, contents: fileEntry.contents },
            { expectedRevision: revision },
          );
          modifiedByTarget.liveLedger += editsByPath.get(fileEntry.path)?.length ?? 0;
        }
      }

      if (changedRuns.length) {
        await options.ingestionStore.writeRuns(options.projectId, changedRuns);
        modifiedByTarget.pendingImports = pendingModified;
      }

      const processed =
        processedByTarget.pendingImports + processedByTarget.liveLedger;
      const modified =
        modifiedByTarget.pendingImports + modifiedByTarget.liveLedger;

      const completed = await options.rulesStore.completeRun(
        options.projectId,
        run.id,
        {
          status: "success",
          processed,
          modified,
          targetCounts: {
            queued: queuedByTarget,
            processed: processedByTarget,
            modified: modifiedByTarget,
          },
        },
      );
      results.push({
        ruleId: rule.id,
        ruleName: completed.ruleName,
        runId: completed.id,
        status: "success",
        queued,
        processed: completed.transactionsProcessed,
        modified: completed.transactionsModified,
        blocked: completed.transactionsBlocked,
        target: options.target,
        targetCounts: completed.targetCounts ?? {
          queued: queuedByTarget,
          processed: processedByTarget,
          modified: modifiedByTarget,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = await options.rulesStore.completeRun(
        options.projectId,
        run.id,
        {
          status: "failed",
          processed:
            processedByTarget.pendingImports + processedByTarget.liveLedger,
          modified:
            modifiedByTarget.pendingImports + modifiedByTarget.liveLedger,
          targetCounts: {
            queued: queuedByTarget,
            processed: processedByTarget,
            modified: modifiedByTarget,
          },
          errorMessage: message,
        },
      );
      results.push({
        ruleId: rule.id,
        ruleName: failed.ruleName,
        runId: failed.id,
        status: "failed",
        queued,
        processed: failed.transactionsProcessed,
        modified: failed.transactionsModified,
        blocked: failed.transactionsBlocked,
        target: options.target,
        targetCounts: failed.targetCounts ?? {
          queued: queuedByTarget,
          processed: processedByTarget,
          modified: modifiedByTarget,
        },
        errorMessage: message,
      });
    }
  }

  return {
    results,
    snapshot: await options.workspace.readProject(options.projectId),
  };
}
