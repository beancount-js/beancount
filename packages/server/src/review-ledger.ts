import { createHash } from "node:crypto";
import {
  Close,
  Commodity,
  Custom,
  FLAG_OKAY,
  FLAG_WARNING,
  Open,
  Price,
  Query,
  type BeancountOptions,
  type Directive,
  type Directives,
} from "@beancount-js/beancount";
import { format as formatBeancount, writeString } from "@beancount-js/parser";
import {
  proposalTransaction,
  type ImportProposal,
  type IngestionRun,
} from "@beancount-js/beangulp";

/** A routing identity only; this file is never created on disk. */
export const ACTIVE_REVIEW_LEDGER_PATH =
  ".beancount/ingestion/active-review.beancount";
export const REVIEW_CONTEXT_META = "studio_review_context";
export const REVIEW_RUN_META = "studio_review_run_id";
export const REVIEW_PROPOSAL_META = "studio_review_proposal_id";
export const REVIEW_CONNECTION_META = "studio_review_connection_id";
export const REVIEW_STATUS_META = "studio_review_status";
export const REVIEW_UNCATEGORISED_ACCOUNT = "Review:Uncategorised";

export type ReviewLedgerProjectionIssue = {
  runId: string;
  proposalId: string;
  message: string;
};

/** A generated, immutable ledger representing the project's active review. */
export type IngestionReviewLedgerSnapshot = {
  kind: "ingestion-review";
  path: typeof ACTIVE_REVIEW_LEDGER_PATH;
  label: "Review transactions";
  contents: string;
  revision: string;
  /** Successfully rendered review transactions. */
  proposalCount: number;
  /** Reviewable proposals before rendering failures are excluded. */
  reviewableCount: number;
  runIds: string[];
  readOnly: true;
  projectionIssues: ReviewLedgerProjectionIssue[];
};

type ReviewableProposal = {
  run: IngestionRun;
  proposal: ImportProposal;
};

function connectionId(sourceId: string) {
  return sourceId.split(":", 1)[0] ?? sourceId;
}

function completedAt(run: IngestionRun) {
  return run.completedAt || run.startedAt;
}

function newestFirst(left: IngestionRun, right: IngestionRun) {
  return (
    completedAt(right).localeCompare(completedAt(left)) ||
    right.startedAt.localeCompare(left.startedAt) ||
    right.id.localeCompare(left.id)
  );
}

export function isReviewLedgerProposal(proposal: ImportProposal) {
  return (
    Boolean(proposal.transaction) &&
    (proposal.status === "ready" ||
      proposal.status === "needs-review" ||
      proposal.status === "held")
  );
}

/**
 * Matches the Review Transactions page's default "All connections" run
 * selection: one newest reviewable run for each top-level connection.
 */
export function pickActiveReviewRuns(runs: readonly IngestionRun[]) {
  const selected = new Map<string, IngestionRun>();
  for (const run of [...runs].sort(newestFirst)) {
    const id = connectionId(run.sourceId);
    if (selected.has(id)) continue;
    if (run.proposals.some(isReviewLedgerProposal)) selected.set(id, run);
  }
  return [...selected.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, run]) => run);
}

function reviewableProposals(runs: readonly IngestionRun[]) {
  return runs.flatMap((run) =>
    run.proposals
      .filter(isReviewLedgerProposal)
      .map((proposal) => ({ run, proposal })),
  );
}

function contextLine(directive: Directive) {
  return `${directive.toString().trimEnd()}\n  ${REVIEW_CONTEXT_META}: TRUE`;
}

function option(name: string, value: string) {
  return `option ${writeString(name)} ${writeString(value)}`;
}

function projectionOptions(options: BeancountOptions) {
  return [
    option("title", "Review transactions"),
    option("name_assets", options.name_assets),
    option("name_liabilities", options.name_liabilities),
    option("name_equity", options.name_equity),
    option("name_income", options.name_income),
    option("name_expenses", options.name_expenses),
    ...options.operating_currency.map((currency) =>
      option("operating_currency", currency),
    ),
  ];
}

function sourceAccounts(
  entries: readonly ReviewableProposal[],
  offsetAccount: string,
) {
  const accounts = new Set<string>();
  for (const { proposal } of entries) {
    const transaction = proposal.transaction;
    if (!transaction) continue;
    accounts.add(transaction.sourceAccount);
    accounts.add(proposal.selectedAccount || offsetAccount);
  }
  return accounts;
}

function reviewOffsetAccount(options: BeancountOptions) {
  return `${options.name_equity}:${REVIEW_UNCATEGORISED_ACCOUNT}`;
}

function contextDirectives(
  directives: Directives,
  accounts: ReadonlySet<string>,
) {
  const opens = new Map<string, Open>();
  for (const directive of directives) {
    if (directive instanceof Open && accounts.has(directive.account)) {
      opens.set(directive.account, directive);
    }
  }

  const copied = directives.filter(
    (directive) =>
      (directive instanceof Open && accounts.has(directive.account)) ||
      (directive instanceof Close && accounts.has(directive.account)) ||
      directive instanceof Commodity ||
      directive instanceof Price ||
      directive instanceof Query ||
      (directive instanceof Custom && directive.type === "fava-option"),
  );
  return { copied, opens };
}

function syntheticOpen(account: string, date: string) {
  return `${date} open ${account}\n  ${REVIEW_CONTEXT_META}: TRUE`;
}

function proposalLine(
  run: IngestionRun,
  proposal: ImportProposal,
  offsetAccount: string,
) {
  const category = proposal.selectedAccount || offsetAccount;
  const rendered = proposalTransaction(proposal, category);
  const transaction = rendered.copy({
    flag: proposal.status === "ready" ? FLAG_OKAY : FLAG_WARNING,
    meta: {
      ...rendered.meta,
      [REVIEW_RUN_META]: run.id,
      [REVIEW_PROPOSAL_META]: proposal.id,
      [REVIEW_CONNECTION_META]: connectionId(run.sourceId),
      [REVIEW_STATUS_META]: proposal.status,
    },
  });
  return transaction.toString().trimEnd();
}

function revision(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

function formatReviewLedgerContents(contents: string) {
  const withoutTrailingWhitespace = contents.replace(/[ \t]+$/gmu, "");
  return `${formatBeancount(withoutTrailingWhitespace)}\n`;
}

/**
 * Project active review proposals into a standalone, read-only Beancount
 * document. Existing ledger entries are context only and never contribute
 * balances or journal activity to the projection.
 */
export function buildIngestionReviewLedger(options: {
  runs: readonly IngestionRun[];
  directives: Directives;
  beancountOptions: BeancountOptions;
}): IngestionReviewLedgerSnapshot | null {
  const runs = pickActiveReviewRuns(options.runs);
  const reviewable = reviewableProposals(runs);
  if (!reviewable.length) return null;

  const offsetAccount = reviewOffsetAccount(options.beancountOptions);
  const accounts = sourceAccounts(reviewable, offsetAccount);
  const { copied, opens } = contextDirectives(options.directives, accounts);
  const earliestDate = reviewable
    .map(({ proposal }) => proposal.transaction!.bookedAt)
    .sort()[0]!;
  const missingOpens = [...accounts]
    .filter((account) => !opens.has(account))
    .sort()
    .map((account) => syntheticOpen(account, earliestDate));
  const projectionIssues: ReviewLedgerProjectionIssue[] = [];
  const transactions: string[] = [];

  for (const { run, proposal } of reviewable) {
    try {
      transactions.push(proposalLine(run, proposal, offsetAccount));
    } catch (error) {
      projectionIssues.push({
        runId: run.id,
        proposalId: proposal.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const contents = formatReviewLedgerContents(
    [
      ";; Generated from the active ingestion review. Read-only.",
      ...projectionOptions(options.beancountOptions),
      "",
      ...copied.map(contextLine),
      ...missingOpens,
      "",
      ...transactions,
      "",
    ]
      .filter((line, index, lines) => line || index === 0 || lines[index - 1])
      .join("\n"),
  );

  return {
    kind: "ingestion-review",
    path: ACTIVE_REVIEW_LEDGER_PATH,
    label: "Review transactions",
    contents,
    revision: revision(contents),
    proposalCount: transactions.length,
    reviewableCount: reviewable.length,
    runIds: runs.map((run) => run.id),
    readOnly: true,
    projectionIssues,
  };
}
