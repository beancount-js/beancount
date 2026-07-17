import { describe, expect, test } from "vitest";
import {
  findReconciliationCandidates,
  type ReconciliationObservation,
} from "./reconciliation";

function observation(
  id: string,
  value: Partial<ReconciliationObservation> = {},
): ReconciliationObservation {
  return {
    id,
    origin: "proposal",
    sourceId: id.split(":")[0],
    sourceAccount: "Assets:Bank:Checking",
    bookedAt: "2026-07-01",
    amount: "-12.50",
    currency: "GBP",
    narration: "Coffee shop",
    status: "posted",
    priority: 0,
    ...value,
  };
}

describe("findReconciliationCandidates", () => {
  test("finds a same-account overlap across providers and selects the higher priority record", () => {
    const result = findReconciliationCandidates([
      observation("lunchflow:1", { narration: "Coffee", priority: 1 }),
      observation("starling:1", {
        narration: "Coffee shop payment",
        priority: 10,
      }),
    ]);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({
      kind: "overlap",
      confidence: "high",
      recommendedCanonicalId: "starling:1",
    });
  });

  test("compares an import with an existing ledger posting", () => {
    const result = findReconciliationCandidates([
      observation("lunchflow:1"),
      observation("ledger:main:12:0", {
        origin: "ledger",
        sourceId: undefined,
        narration: "Manual coffee",
      }),
    ]);

    expect(result.candidates[0]).toMatchObject({ kind: "existing" });
  });

  test("finds a two-sided transfer with exact opposite amounts", () => {
    const result = findReconciliationCandidates(
      [
        observation("starling:out", {
          sourceAccount: "Assets:Bank:Starling",
          amount: "-250.00",
          narration: "Transfer to savings",
        }),
        observation("lunchflow:in", {
          sourceAccount: "Assets:Bank:Savings",
          amount: "250.00",
          narration: "Transfer from Starling",
          bookedAt: "2026-07-03",
        }),
      ],
      {
        transferAccounts: new Set([
          "Assets:Bank:Starling",
          "Assets:Bank:Savings",
        ]),
      },
    );

    expect(result.candidates[0]).toMatchObject({
      kind: "transfer",
      confidence: "possible",
    });
  });

  test("requires provider evidence before suggesting a foreign-exchange transfer", () => {
    const debit = observation("starling:out", {
      sourceAccount: "Assets:Bank:GBP",
      amount: "-100.00",
      currency: "GBP",
    });
    const credit = observation("wise:in", {
      sourceAccount: "Assets:Bank:USD",
      amount: "125.00",
      currency: "USD",
    });
    const options = {
      transferAccounts: new Set(["Assets:Bank:GBP", "Assets:Bank:USD"]),
    };
    expect(
      findReconciliationCandidates([debit, credit], options).candidates,
    ).toHaveLength(0);

    const matched = findReconciliationCandidates(
      [
        {
          ...debit,
          transferEvidence: { exchangeRate: "1.25" },
        },
        credit,
      ],
      options,
    );
    expect(matched.candidates[0]).toMatchObject({ kind: "transfer" });
  });

  test("does not return a previously dismissed pair", () => {
    const first = observation("a");
    const second = observation("b");
    const candidate = findReconciliationCandidates([first, second])
      .candidates[0]!;
    const next = findReconciliationCandidates([first, second], {
      dismissedCandidateIds: new Set([candidate.id]),
    });
    expect(next.candidates).toEqual([]);
  });

  test("scans only the configured date window without depending on input order", () => {
    const observations = Array.from({ length: 336 }, (_, index) =>
      observation(`distant:${index}`, {
        bookedAt: `2025-${String(Math.floor(index / 28) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
        amount: String(index + 1),
      }),
    );
    observations.push(
      observation("match:later", { bookedAt: "2026-07-03" }),
      observation("match:earlier", { bookedAt: "2026-07-01" }),
    );

    const result = findReconciliationCandidates(observations.reverse());

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.memberIds).toEqual([
      "match:earlier",
      "match:later",
    ]);
  });
});
