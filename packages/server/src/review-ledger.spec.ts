import { describe, expect, test } from "vitest";
import { loadString } from "@beancount-js/beancount";
import type { IngestionRun } from "@beancount-js/beangulp";
import {
  ACTIVE_REVIEW_LEDGER_PATH,
  buildIngestionReviewLedger,
  pickActiveReviewRuns,
  REVIEW_CONNECTION_META,
  REVIEW_CONTEXT_META,
  REVIEW_PROPOSAL_META,
  REVIEW_RUN_META,
  REVIEW_STATUS_META,
} from "./review-ledger";

function run(
  id: string,
  sourceId: string,
  completedAt: string,
  proposals: IngestionRun["proposals"],
): IngestionRun {
  return {
    id,
    sourceId,
    startedAt: completedAt,
    completedAt,
    proposals,
    summary: {
      total: proposals.length,
      ready: proposals.filter((proposal) => proposal.status === "ready").length,
      needsReview: proposals.filter(
        (proposal) => proposal.status === "needs-review",
      ).length,
      accepted: proposals.filter((proposal) => proposal.status === "accepted")
        .length,
      duplicates: proposals.filter((proposal) => proposal.status === "duplicate")
        .length,
      invalid: proposals.filter((proposal) => proposal.status === "invalid")
        .length,
      held: proposals.filter((proposal) => proposal.status === "held").length,
      excluded: proposals.filter((proposal) => proposal.status === "excluded")
        .length,
    },
  };
}

function proposal(
  id: string,
  status: "ready" | "needs-review" | "held" | "accepted" = "ready",
  selectedAccount?: string,
) {
  return {
    id,
    importId: `import:${id}`,
    status,
    ...(selectedAccount ? { selectedAccount } : {}),
    suggestions: [],
    issues: [],
    transaction: {
      sourceId: "bank:checking",
      sourceAccount: "Assets:Bank",
      bookedAt: "2026-07-16",
      amount: "-12.50",
      currency: "GBP",
      narration: "Lunch",
      status: "posted" as const,
      fetchedAt: "2026-07-16T10:00:00.000Z",
      metadata: {},
    },
  };
}

function source() {
  return loadString(`
option "operating_currency" "GBP"
2020-01-01 open Assets:Bank GBP
2020-01-01 open Expenses:Food GBP
2020-01-01 commodity GBP
2026-07-15 price USD 0.80 GBP
2020-01-01 query "recent" "SELECT * FROM OPEN"
2020-01-01 custom "fava-option" "currency_column" "GBP"
2024-01-01 * "Old transaction"
  Assets:Bank  -1 GBP
  Expenses:Food
`);
}

describe("active ingestion review ledger", () => {
  test("chooses the newest reviewable run for each connection", () => {
    const selected = pickActiveReviewRuns([
      run("old-bank", "bank:checking", "2026-07-14T00:00:00.000Z", [
        proposal("old", "needs-review"),
      ]),
      run("new-bank", "bank:savings", "2026-07-16T00:00:00.000Z", [
        proposal("new", "ready", "Expenses:Food"),
      ]),
      run("card", "card", "2026-07-15T00:00:00.000Z", [
        proposal("card", "held"),
      ]),
      run("done", "cash", "2026-07-17T00:00:00.000Z", [
        proposal("done", "accepted", "Expenses:Food"),
      ]),
    ]);

    expect(selected.map((item) => item.id)).toEqual(["new-bank", "card"]);
  });

  test("renders review items with identity metadata and no historical transactions", () => {
    const [directives, , options] = source();
    const ledger = buildIngestionReviewLedger({
      directives,
      beancountOptions: options,
      runs: [
        run("run:bank", "bank:checking", "2026-07-16T12:00:00.000Z", [
          proposal("ready", "ready", "Expenses:Food"),
          proposal("pending", "needs-review"),
        ]),
      ],
    });

    expect(ledger).toMatchObject({
      kind: "ingestion-review",
      path: ACTIVE_REVIEW_LEDGER_PATH,
      proposalCount: 2,
      reviewableCount: 2,
      runIds: ["run:bank"],
      readOnly: true,
      projectionIssues: [],
    });
    expect(ledger?.contents).toContain('2026-07-16 * "Lunch"');
    expect(ledger?.contents).toContain('2026-07-16 ! "Lunch"');
    expect(ledger?.contents).toContain("Equity:Review:Uncategorised");
    expect(ledger?.contents).toContain(`${REVIEW_RUN_META}: "run:bank"`);
    expect(ledger?.contents).toContain(`${REVIEW_PROPOSAL_META}: "pending"`);
    expect(ledger?.contents).toContain(
      `${REVIEW_CONNECTION_META}: "bank"`,
    );
    expect(ledger?.contents).toContain(
      `${REVIEW_STATUS_META}: "needs-review"`,
    );
    expect(ledger?.contents).toContain(`${REVIEW_CONTEXT_META}: TRUE`);
    expect(ledger?.contents).not.toContain("Old transaction");

    const [, errors] = loadString(ledger!.contents);
    expect(errors).toEqual([]);
  });

  test("is absent without reviewable proposals and has a stable revision", () => {
    const [directives, , options] = source();
    const runs = [
      run("done", "bank", "2026-07-16T00:00:00.000Z", [
        proposal("done", "accepted", "Expenses:Food"),
      ]),
    ];
    expect(
      buildIngestionReviewLedger({
        directives,
        beancountOptions: options,
        runs,
      }),
    ).toBeNull();

    const activeRuns = [
      run("active", "bank", "2026-07-16T00:00:00.000Z", [
        proposal("active", "ready", "Expenses:Food"),
      ]),
    ];
    const first = buildIngestionReviewLedger({
      directives,
      beancountOptions: options,
      runs: activeRuns,
    });
    const second = buildIngestionReviewLedger({
      directives,
      beancountOptions: options,
      runs: activeRuns,
    });
    expect(first?.revision).toBe(second?.revision);
  });
});
