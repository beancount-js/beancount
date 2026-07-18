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

export type RuleApplySummary = {
  target: RuleApplyTarget;
  /** Total rule matches, including a record matched by more than one rule. */
  matched: RuleRunTargetCounts;
  /** Distinct records matched by at least one selected rule. */
  unique: RuleRunTargetCounts;
  /** Distinct records whose final state would change. */
  modified: RuleRunTargetCounts;
  /** Additional matches after the first match for each record. */
  overlaps: RuleRunTargetCounts;
  /** Different later writes to the same non-additive field. */
  conflicts: RuleRunTargetCounts;
};

function emptyTargetCounts(): RuleRunTargetCounts {
  return { pendingImports: 0, liveLedger: 0 };
}

function totalTargetCounts(counts: RuleRunTargetCounts) {
  return counts.pendingImports + counts.liveLedger;
}

function copyTargetCounts(counts: RuleRunTargetCounts): RuleRunTargetCounts {
  return {
    pendingImports: counts.pendingImports,
    liveLedger: counts.liveLedger,
  };
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
  const liveLedger = targetIncludesLiveLedger(target) ? counts.liveLedger : 0;
  return { pendingImports, liveLedger, total: pendingImports + liveLedger };
}

function errorMessages(errors: readonly { message: string }[]) {
  return new Set(errors.map((error) => error.message));
}

function proposalContext(
  proposal: ImportProposal,
): RuleEvaluationContext | undefined {
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
): ImportProposal | undefined {
  if (!proposal.transaction) return undefined;
  let transaction = proposal.transaction;
  let changed = false;
  if (
    patch.narration !== undefined &&
    patch.narration !== transaction.narration
  ) {
    transaction = { ...transaction, narration: patch.narration };
    changed = true;
  }
  if (patch.merchant !== undefined && patch.merchant !== transaction.merchant) {
    transaction = { ...transaction, merchant: patch.merchant };
    changed = true;
  }
  const currentTags = transaction.tags ?? [];
  if (
    patch.tags &&
    (patch.tags.length !== currentTags.length ||
      patch.tags.some((tag, index) => tag !== currentTags[index]))
  ) {
    transaction = { ...transaction, tags: patch.tags };
    changed = true;
  }
  const selectedAccount = patch.selectedAccount ?? proposal.selectedAccount;
  if (selectedAccount !== proposal.selectedAccount) changed = true;
  const status = patch.exclude ? "excluded" : proposal.status;
  if (status !== proposal.status) changed = true;
  if (!changed) return undefined;
  return { ...proposal, transaction, selectedAccount, status };
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

type RuleTargetKey = keyof RuleRunTargetCounts;
type RuleField = "category" | "merchant" | "narration";

type RulePlan = {
  rule: DetectionRule;
  queued: RuleRunTargetCounts;
  processed: RuleRunTargetCounts;
  modified: RuleRunTargetCounts;
};

type FieldWrite = { ruleId: string; value: string };

type PlannedPendingRecord = {
  runIndex: number;
  proposalIndex: number;
  original: ImportProposal;
  current: ImportProposal;
  matches: number;
  changed: boolean;
  fields: Map<RuleField, FieldWrite>;
};

type PlannedLedgerRecord = {
  path: string;
  original: Transaction;
  current: Transaction;
  matches: number;
  changed: boolean;
  fields: Map<RuleField, FieldWrite>;
};

type RuleApplyPlan = {
  runs: readonly IngestionRun[];
  snapshot: Awaited<ReturnType<FilesystemWorkspaceAdapter["readProject"]>>;
  previousErrors: readonly { message: string }[];
  rulePlans: RulePlan[];
  pendingRecords: PlannedPendingRecord[];
  ledgerRecords: PlannedLedgerRecord[];
  summary: RuleApplySummary;
};

type StartedRulePlan = {
  plan: RulePlan;
  run: Awaited<ReturnType<FilesystemRulesStore["startRun"]>>;
};

type LedgerSourcePlan = {
  sourceFiles: Array<{ path: string; contents: string }>;
  changedPaths: Set<string>;
};

function emptySummary(target: RuleApplyTarget): RuleApplySummary {
  return {
    target,
    matched: emptyTargetCounts(),
    unique: emptyTargetCounts(),
    modified: emptyTargetCounts(),
    overlaps: emptyTargetCounts(),
    conflicts: emptyTargetCounts(),
  };
}

function selectableRules(
  rules: readonly DetectionRule[],
  ruleIds: readonly string[] | undefined,
) {
  return ruleIds?.length
    ? rules.filter((rule) => ruleIds.includes(rule.id))
    : rules.filter((rule) => rule.active);
}

function pendingProposalIsApplicable(proposal: ImportProposal) {
  return (
    Boolean(proposal.transaction) &&
    (proposal.status === "ready" ||
      proposal.status === "needs-review" ||
      proposal.status === "held")
  );
}

function incrementMatch(plan: RulePlan, target: RuleTargetKey) {
  plan.queued[target] += 1;
  plan.processed[target] += 1;
}

function noteFieldWrite(
  fields: Map<RuleField, FieldWrite>,
  field: RuleField,
  value: string,
  rule: DetectionRule,
  target: RuleTargetKey,
  summary: RuleApplySummary,
) {
  const previous = fields.get(field);
  if (previous && previous.ruleId !== rule.id && previous.value !== value) {
    summary.conflicts[target] += 1;
  }
  fields.set(field, { ruleId: rule.id, value });
}

function postingAccountsChanged(left: Transaction, right: Transaction) {
  return left.postings.some(
    (posting, index) => posting.account !== right.postings[index]?.account,
  );
}

function targetCountFromRecords<
  T extends { matches: number; changed: boolean },
>(records: readonly T[]) {
  return {
    unique: records.filter((record) => record.matches > 0).length,
    modified: records.filter((record) => record.changed).length,
  };
}

async function planRuleApply(options: {
  projectId: string;
  ruleIds?: string[];
  target: RuleApplyTarget;
  rulesStore: FilesystemRulesStore;
  ingestionStore: FilesystemIngestionStore;
  workspace: FilesystemWorkspaceAdapter;
}): Promise<RuleApplyPlan> {
  const file = await options.rulesStore.readRules(options.projectId);
  const selected = selectableRules(file.rules, options.ruleIds);
  const runs = await options.ingestionStore.readRuns(options.projectId);
  const snapshot = await options.workspace.readProject(options.projectId);
  const [entries, previousErrors] = loadProjectSources(
    snapshot.project.entryFile,
    snapshot.ledgerFiles.map((file) => ({
      path: file.path,
      contents: file.contents,
    })),
  );

  const summary = emptySummary(options.target);
  const rulePlans = selected.map((rule) => ({
    rule,
    queued: emptyTargetCounts(),
    processed: emptyTargetCounts(),
    modified: emptyTargetCounts(),
  }));
  const pendingRecords: PlannedPendingRecord[] = targetIncludesPendingImports(
    options.target,
  )
    ? runs.flatMap((run, runIndex) =>
        run.proposals
          .map((proposal, proposalIndex) => ({
            runIndex,
            proposalIndex,
            original: proposal,
            current: proposal,
            matches: 0,
            changed: false,
            fields: new Map<RuleField, FieldWrite>(),
          }))
          .filter((record) => pendingProposalIsApplicable(record.current)),
      )
    : [];
  const ledgerRecords: PlannedLedgerRecord[] = targetIncludesLiveLedger(
    options.target,
  )
    ? entries.flatMap((entry) => {
        if (!(entry instanceof Transaction)) return [];
        const source = entry.source;
        const path =
          typeof entry.meta.filename === "string" ? entry.meta.filename : "";
        if (!source || !path) return [];
        return [
          {
            path,
            original: entry,
            current: entry,
            matches: 0,
            changed: false,
            fields: new Map<RuleField, FieldWrite>(),
          } satisfies PlannedLedgerRecord,
        ];
      })
    : [];

  for (const rulePlan of rulePlans) {
    const { rule } = rulePlan;
    for (const record of pendingRecords) {
      if (!pendingProposalIsApplicable(record.current)) continue;
      const context = proposalContext(record.current);
      if (!context || !ruleMatches(rule, context)) continue;
      incrementMatch(rulePlan, "pendingImports");
      record.matches += 1;
      const patch = applyRuleActions(rule, context);
      if (!patch) continue;
      const next = applyPatchToProposal(record.current, patch);
      if (!next) continue;
      if (
        patch.selectedAccount !== undefined &&
        next.selectedAccount !== record.current.selectedAccount
      ) {
        noteFieldWrite(
          record.fields,
          "category",
          next.selectedAccount ?? "",
          rule,
          "pendingImports",
          summary,
        );
      }
      if (
        patch.merchant !== undefined &&
        next.transaction?.merchant !== record.current.transaction?.merchant
      ) {
        noteFieldWrite(
          record.fields,
          "merchant",
          next.transaction?.merchant ?? "",
          rule,
          "pendingImports",
          summary,
        );
      }
      if (
        patch.narration !== undefined &&
        next.transaction?.narration !== record.current.transaction?.narration
      ) {
        noteFieldWrite(
          record.fields,
          "narration",
          next.transaction?.narration ?? "",
          rule,
          "pendingImports",
          summary,
        );
      }
      record.current = next;
      record.changed = true;
      rulePlan.modified.pendingImports += 1;
    }

    for (const record of ledgerRecords) {
      const context = ledgerContext(record.current);
      if (!context || !ruleMatches(rule, context)) continue;
      incrementMatch(rulePlan, "liveLedger");
      record.matches += 1;
      const patch = applyRuleActions(rule, context);
      if (!patch) continue;
      const next = applyPatchToLedger(record.current, patch, context);
      if (!next) continue;
      if (
        patch.selectedAccount !== undefined &&
        postingAccountsChanged(record.current, next)
      ) {
        noteFieldWrite(
          record.fields,
          "category",
          patch.selectedAccount,
          rule,
          "liveLedger",
          summary,
        );
      }
      if (patch.merchant !== undefined && next.payee !== record.current.payee) {
        noteFieldWrite(
          record.fields,
          "merchant",
          next.payee ?? "",
          rule,
          "liveLedger",
          summary,
        );
      }
      if (
        patch.narration !== undefined &&
        next.narration !== record.current.narration
      ) {
        noteFieldWrite(
          record.fields,
          "narration",
          next.narration ?? "",
          rule,
          "liveLedger",
          summary,
        );
      }
      record.current = next;
      record.changed = true;
      rulePlan.modified.liveLedger += 1;
    }
  }

  for (const rulePlan of rulePlans) {
    summary.matched.pendingImports += rulePlan.processed.pendingImports;
    summary.matched.liveLedger += rulePlan.processed.liveLedger;
  }
  const pendingCounts = targetCountFromRecords(pendingRecords);
  const ledgerCounts = targetCountFromRecords(ledgerRecords);
  summary.unique.pendingImports = pendingCounts.unique;
  summary.unique.liveLedger = ledgerCounts.unique;
  summary.modified.pendingImports = pendingCounts.modified;
  summary.modified.liveLedger = ledgerCounts.modified;
  summary.overlaps.pendingImports = Math.max(
    summary.matched.pendingImports - summary.unique.pendingImports,
    0,
  );
  summary.overlaps.liveLedger = Math.max(
    summary.matched.liveLedger - summary.unique.liveLedger,
    0,
  );

  return {
    runs,
    snapshot,
    previousErrors,
    rulePlans,
    pendingRecords,
    ledgerRecords,
    summary,
  };
}

export type RuleApplyPreviewResult = {
  preview: RuleApplyPreview[];
  summary: RuleApplySummary;
};

export async function previewRuleApply(options: {
  projectId: string;
  ruleIds?: string[];
  target: RuleApplyTarget;
  rulesStore: FilesystemRulesStore;
  ingestionStore: FilesystemIngestionStore;
  workspace: FilesystemWorkspaceAdapter;
}): Promise<RuleApplyPreviewResult> {
  const plan = await planRuleApply(options);
  return {
    preview: plan.rulePlans.map((rulePlan) => {
      const counts = {
        pendingImports: rulePlan.queued.pendingImports,
        liveLedger: rulePlan.queued.liveLedger,
      } satisfies RuleRunTargetCounts;
      return {
        ruleId: rulePlan.rule.id,
        ruleName: rulePlan.rule.name ?? "Untitled rule",
        target: options.target,
        ...counts,
        total: totalTargetCounts(counts),
      } satisfies RuleApplyPreview;
    }),
    summary: plan.summary,
  };
}

function ledgerSourcePlan(plan: RuleApplyPlan): LedgerSourcePlan {
  type Edit = {
    from: number;
    to: number;
    original: string;
    next: string;
  };
  const editsByPath = new Map<string, Edit[]>();
  for (const record of plan.ledgerRecords) {
    if (!record.changed) continue;
    const source = record.original.source;
    if (!source) continue;
    const edits = editsByPath.get(record.path) ?? [];
    edits.push({
      from: source.position.from,
      to: source.position.to,
      original: source.content,
      next: record.current.toString().trimEnd() + "\n",
    });
    editsByPath.set(record.path, edits);
  }

  const changedPaths = new Set(editsByPath.keys());
  const sourceFiles = plan.snapshot.ledgerFiles.map((fileEntry) => {
    const edits = editsByPath.get(fileEntry.path);
    if (!edits) return { path: fileEntry.path, contents: fileEntry.contents };
    let contents = fileEntry.contents;
    for (const edit of [...edits].sort(
      (left, right) => right.from - left.from,
    )) {
      if (contents.slice(edit.from, edit.to) !== edit.original) {
        throw new Error(
          `Ledger changed while applying rules to ${fileEntry.path}; reload and retry.`,
        );
      }
      contents = `${contents.slice(0, edit.from)}${edit.next}${contents.slice(edit.to)}`;
    }
    return { path: fileEntry.path, contents };
  });
  return { sourceFiles, changedPaths };
}

function validateLedgerSourcePlan(
  plan: RuleApplyPlan,
  sourcePlan: LedgerSourcePlan,
) {
  if (!sourcePlan.changedPaths.size) return;
  const [, nextErrors] = loadProjectSources(
    plan.snapshot.project.entryFile,
    sourcePlan.sourceFiles,
  );
  const known = errorMessages(plan.previousErrors);
  const introduced = nextErrors.filter((error) => !known.has(error.message));
  if (introduced.length) {
    throw new Error(
      `Applying rules would introduce ledger errors: ${introduced
        .map((error) => error.message)
        .join("; ")}`,
    );
  }
}

async function writeLedgerSourcePlan(
  plan: RuleApplyPlan,
  sourcePlan: LedgerSourcePlan,
  options: { projectId: string; workspace: FilesystemWorkspaceAdapter },
) {
  validateLedgerSourcePlan(plan, sourcePlan);
  for (const fileEntry of sourcePlan.sourceFiles) {
    if (!sourcePlan.changedPaths.has(fileEntry.path)) continue;
    const revision = plan.snapshot.revisions.find(
      (item) => item.path === fileEntry.path,
    )?.revision;
    if (!revision) {
      throw new Error(`Missing ledger file revision for ${fileEntry.path}.`);
    }
    await options.workspace.writeFile(options.projectId, fileEntry, {
      expectedRevision: revision,
    });
  }
}

function pendingRunChanges(plan: RuleApplyPlan) {
  const recordsByRun = new Map<number, PlannedPendingRecord[]>();
  for (const record of plan.pendingRecords) {
    if (!record.changed) continue;
    const records = recordsByRun.get(record.runIndex) ?? [];
    records.push(record);
    recordsByRun.set(record.runIndex, records);
  }
  return [...recordsByRun].map(([runIndex, records]) => {
    const current = plan.runs[runIndex]!;
    const proposals = [...current.proposals];
    for (const record of records) {
      proposals[record.proposalIndex] = record.current;
    }
    return { ...current, proposals } satisfies IngestionRun;
  });
}

function targetCountsFor(plan: RulePlan, modified: RuleRunTargetCounts) {
  return {
    queued: copyTargetCounts(plan.queued),
    processed: copyTargetCounts(plan.processed),
    modified: copyTargetCounts(modified),
  };
}

function resultFor(
  completed: Awaited<ReturnType<FilesystemRulesStore["completeRun"]>>,
  plan: RulePlan,
  target: RuleApplyTarget,
  modified: RuleRunTargetCounts,
  errorMessage?: string,
): RuleApplyResult {
  return {
    ruleId: plan.rule.id,
    ruleName: completed.ruleName,
    runId: completed.id,
    status: completed.status === "failed" ? "failed" : "success",
    queued: completed.transactionsQueued,
    processed: completed.transactionsProcessed,
    modified: completed.transactionsModified,
    blocked: completed.transactionsBlocked,
    target,
    targetCounts: completed.targetCounts ?? targetCountsFor(plan, modified),
    ...(errorMessage ? { errorMessage } : {}),
  };
}

function completedSummary(
  summary: RuleApplySummary,
  applied: RuleRunTargetCounts,
) {
  return {
    ...summary,
    matched: copyTargetCounts(summary.matched),
    unique: copyTargetCounts(summary.unique),
    overlaps: copyTargetCounts(summary.overlaps),
    conflicts: copyTargetCounts(summary.conflicts),
    modified: {
      pendingImports: applied.pendingImports
        ? summary.modified.pendingImports
        : 0,
      liveLedger: applied.liveLedger ? summary.modified.liveLedger : 0,
    },
  } satisfies RuleApplySummary;
}

export async function applyDetectionRules(options: {
  projectId: string;
  ruleIds?: string[];
  target: RuleApplyTarget;
  rulesStore: FilesystemRulesStore;
  ingestionStore: FilesystemIngestionStore;
  workspace: FilesystemWorkspaceAdapter;
}): Promise<{
  results: RuleApplyResult[];
  snapshot: Awaited<ReturnType<FilesystemWorkspaceAdapter["readProject"]>>;
  summary: RuleApplySummary;
}> {
  const plan = await planRuleApply(options);
  const started: StartedRulePlan[] = [];
  for (const rulePlan of plan.rulePlans) {
    const queued = totalTargetCounts(rulePlan.queued);
    const run = await options.rulesStore.startRun(options.projectId, {
      ruleId: rulePlan.rule.id,
      ruleName: rulePlan.rule.name ?? "Untitled rule",
      queued,
      target: options.target,
      targetCounts: targetCountsFor(rulePlan, emptyTargetCounts()),
    });
    started.push({ plan: rulePlan, run });
  }

  const modifiedByRule = new Map<RulePlan, RuleRunTargetCounts>(
    plan.rulePlans.map((rulePlan) => [rulePlan, emptyTargetCounts()]),
  );
  const applied = emptyTargetCounts();
  try {
    if (targetIncludesLiveLedger(options.target)) {
      await writeLedgerSourcePlan(plan, ledgerSourcePlan(plan), options);
      if (plan.ledgerRecords.some((record) => record.changed)) {
        applied.liveLedger = 1;
        for (const rulePlan of plan.rulePlans) {
          modifiedByRule.get(rulePlan)!.liveLedger =
            rulePlan.modified.liveLedger;
        }
      }
    }
    if (targetIncludesPendingImports(options.target)) {
      const changedRuns = pendingRunChanges(plan);
      if (changedRuns.length) {
        await options.ingestionStore.writeRuns(options.projectId, changedRuns);
        applied.pendingImports = 1;
        for (const rulePlan of plan.rulePlans) {
          modifiedByRule.get(rulePlan)!.pendingImports =
            rulePlan.modified.pendingImports;
        }
      }
    }

    const results: RuleApplyResult[] = [];
    for (const startedPlan of started) {
      const modified = modifiedByRule.get(startedPlan.plan)!;
      const completed = await options.rulesStore.completeRun(
        options.projectId,
        startedPlan.run.id,
        {
          status: "success",
          processed: totalTargetCounts(startedPlan.plan.processed),
          modified: totalTargetCounts(modified),
          targetCounts: targetCountsFor(startedPlan.plan, modified),
        },
      );
      results.push(
        resultFor(completed, startedPlan.plan, options.target, modified),
      );
    }
    return {
      results,
      snapshot: await options.workspace.readProject(options.projectId),
      summary: completedSummary(plan.summary, applied),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const results: RuleApplyResult[] = [];
    for (const startedPlan of started) {
      const modified = modifiedByRule.get(startedPlan.plan)!;
      const failed = await options.rulesStore.completeRun(
        options.projectId,
        startedPlan.run.id,
        {
          status: "failed",
          processed: totalTargetCounts(startedPlan.plan.processed),
          modified: totalTargetCounts(modified),
          targetCounts: targetCountsFor(startedPlan.plan, modified),
          errorMessage: message,
        },
      );
      results.push(
        resultFor(failed, startedPlan.plan, options.target, modified, message),
      );
    }
    return {
      results,
      snapshot: await options.workspace.readProject(options.projectId),
      summary: completedSummary(plan.summary, applied),
    };
  }
}
