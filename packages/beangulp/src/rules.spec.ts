import { describe, expect, test } from "vitest";
import type { NormalizedTransaction } from "./types";
import {
  RuleCategorizer,
  RuleActionsHook,
  applyRuleActions,
  createRuleRegistry,
  firstCategoryMatch,
  migrateMerchantRules,
  parseRuleRun,
  parseRulesFile,
  ruleBlockedCount,
  ruleMatches,
  summarizeRule,
  validateDetectionRule,
  type DetectionRule,
} from "./rules";

function tx(
  overrides: Partial<NormalizedTransaction> = {},
): NormalizedTransaction {
  return {
    sourceId: "bank",
    sourceAccount: "Assets:Bank:Current",
    bookedAt: "2026-07-01",
    amount: "-42.00",
    currency: "GBP",
    merchant: "Plata",
    narration: "Plata payment",
    status: "posted",
    fetchedAt: "2026-07-02T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

function rule(
  partial: Partial<DetectionRule> & Pick<DetectionRule, "id">,
): DetectionRule {
  return {
    name: "Plata",
    resourceType: "transaction",
    active: true,
    effectiveDate: null,
    conditions: [
      {
        id: "c1",
        conditionType: "transaction_name",
        operator: "like",
        value: "Plata",
      },
    ],
    actions: [
      {
        id: "a1",
        actionType: "set_transaction_category",
        value: "Expenses:Debt:Repayment",
      },
    ],
    ...partial,
  };
}

describe("detection rules", () => {
  test("matches name contains and returns category action", () => {
    const match = firstCategoryMatch([rule({ id: "r1" })], {
      transaction: tx(),
    });
    expect(match?.account).toBe("Expenses:Debt:Repayment");
  });

  test("supports compound OR groups", () => {
    const detection = rule({
      id: "r1",
      conditions: [
        {
          id: "g1",
          conditionType: "compound",
          operator: "or",
          value: null,
          subConditions: [
            {
              id: "c1",
              conditionType: "transaction_name",
              operator: "like",
              value: "Nope",
            },
            {
              id: "c2",
              conditionType: "transaction_merchant",
              operator: "=",
              value: "Plata",
            },
          ],
        },
      ],
    });
    expect(ruleMatches(detection, { transaction: tx() })).toBe(true);
  });

  test("exposes comprehensive text, reference, select, and number operators", () => {
    const registry = createRuleRegistry();
    const operators = (key: string) =>
      registry.filters
        .find((filter) => filter.key === key)
        ?.operators.map((operator) => operator.value);

    expect(operators("transaction_name")).toEqual([
      "like",
      "not_like",
      "=",
      "!=",
      "matches",
      "not_matches",
      "is_null",
      "is_not_null",
    ]);
    expect(operators("transaction_merchant")).toEqual(
      operators("transaction_name"),
    );
    expect(operators("transaction_account")).toEqual(
      operators("transaction_name"),
    );
    expect(operators("transaction_type")).toEqual([
      "=",
      "!=",
      "is_null",
      "is_not_null",
    ]);
    expect(operators("transaction_amount")).toContain("!=");
  });

  test("evaluates negative, empty, and regular-expression text operators", () => {
    const matches = (operator: string, value: string | null) =>
      ruleMatches(
        rule({
          id: `rule-${operator}`,
          conditions: [
            {
              id: `condition-${operator}`,
              conditionType: "transaction_name",
              operator,
              value,
            },
          ],
        }),
        { transaction: tx({ narration: "Coffee at CAFE 42" }) },
      );

    expect(matches("not_like", "tea")).toBe(true);
    expect(matches("not_like", "cafe")).toBe(false);
    expect(matches("!=", "Coffee at another cafe")).toBe(true);
    expect(matches("matches", "^coffee\\s+at\\s+cafe\\s+\\d+$")).toBe(true);
    expect(matches("matches", "/^Coffee at CAFE 42$/")).toBe(true);
    expect(matches("not_matches", "tea|bakery")).toBe(true);
    expect(matches("is_not_null", null)).toBe(true);
    expect(matches("matches", "[")).toBe(false);
    expect(matches("not_matches", "[")).toBe(false);
  });

  test("evaluates not-equal operators for typed rule fields", () => {
    const matches = (
      conditionType: "transaction_amount" | "transaction_type",
      value: string,
    ) =>
      ruleMatches(
        rule({
          id: `rule-${conditionType}`,
          conditions: [
            {
              id: `condition-${conditionType}`,
              conditionType,
              operator: "!=",
              value,
            },
          ],
        }),
        { transaction: tx() },
      );

    expect(matches("transaction_amount", "41")).toBe(true);
    expect(matches("transaction_amount", "42")).toBe(false);
    expect(matches("transaction_type", "income")).toBe(true);
    expect(matches("transaction_type", "expense")).toBe(false);
  });

  test("validates regular expressions in leaf and grouped conditions", () => {
    const invalid = rule({
      id: "invalid-regex",
      conditions: [
        {
          id: "regex-group",
          conditionType: "compound",
          operator: "and",
          value: null,
          subConditions: [
            {
              id: "invalid-pattern",
              conditionType: "transaction_name",
              operator: "matches",
              value: "[",
            },
          ],
        },
      ],
    });

    expect(validateDetectionRule(invalid)).toContain(
      "Condition transaction_name requires a valid regular expression.",
    );
  });

  test("respects effectiveDate", () => {
    const detection = rule({
      id: "r1",
      effectiveDate: "2026-08-01",
    });
    expect(
      ruleMatches(detection, {
        transaction: tx({ bookedAt: "2026-07-01" }),
      }),
    ).toBe(false);
    expect(
      ruleMatches(detection, {
        transaction: tx({ bookedAt: "2026-08-15" }),
      }),
    ).toBe(true);
  });

  test("applies non-category actions", () => {
    const detection = rule({
      id: "r1",
      actions: [
        {
          id: "a1",
          actionType: "set_transaction_name",
          value: "Debt repayment",
        },
        {
          id: "a2",
          actionType: "set_transaction_tags",
          value: "debt,repay",
        },
        { id: "a3", actionType: "exclude_transaction", value: null },
      ],
    });
    expect(applyRuleActions(detection, { transaction: tx() })).toMatchObject({
      narration: "Debt repayment",
      tags: ["debt", "repay"],
      exclude: true,
    });
  });

  test("registers AI actions without invoking them during deterministic ingestion", () => {
    const detection = rule({
      id: "r1",
      actions: [
        {
          id: "a1",
          actionType: "auto_categorise_with_ai",
          value: null,
        },
        {
          id: "a2",
          actionType: "auto_detect_merchant_with_ai",
          value: null,
        },
      ],
    });

    expect(validateDetectionRule(detection)).toEqual([]);
    expect(applyRuleActions(detection, { transaction: tx() })).toBeUndefined();
    expect(
      createRuleRegistry().executors.map((executor) => executor.key),
    ).toEqual(
      expect.arrayContaining([
        "auto_categorise_with_ai",
        "auto_detect_merchant_with_ai",
      ]),
    );
  });

  test("migrates merchant rules", () => {
    const migrated = migrateMerchantRules([
      {
        merchant: "Tesco",
        account: "Expenses:Food:Groceries",
        sourceAccount: "Assets:Bank:Current",
        direction: "debit",
      },
    ]);
    expect(migrated).toHaveLength(1);
    expect(migrated[0].name).toBe("Tesco");
    expect(migrated[0].actions[0]).toMatchObject({
      actionType: "set_transaction_category",
      value: "Expenses:Food:Groceries",
    });
    expect(migrated[0].conditions.map((c) => c.conditionType)).toEqual([
      "transaction_merchant",
      "transaction_account",
      "transaction_type",
    ]);
  });

  test("RuleCategorizer emits hard rule suggestions", async () => {
    const categorizer = new RuleCategorizer([rule({ id: "r1" })]);
    const suggestions = await categorizer.suggest({
      transaction: tx(),
      history: [],
      availableAccounts: ["Expenses:Debt:Repayment"],
    });
    expect(suggestions[0]).toMatchObject({
      account: "Expenses:Debt:Repayment",
      method: "rule",
      hard: true,
    });
  });

  test("applies matching rule actions in stored order during ingestion", async () => {
    const hook = new RuleActionsHook([
      rule({
        id: "r1",
        actions: [
          {
            id: "a1",
            actionType: "set_transaction_name",
            value: "Debt repayment",
          },
          {
            id: "a2",
            actionType: "set_transaction_category",
            value: "Expenses:Debt:Repayment",
          },
        ],
      }),
      rule({
        id: "r2",
        conditions: [
          {
            id: "c2",
            conditionType: "transaction_name",
            operator: "=",
            value: "Debt repayment",
          },
        ],
        actions: [
          {
            id: "a3",
            actionType: "set_transaction_category",
            value: "Expenses:Debt:Loan",
          },
          {
            id: "a4",
            actionType: "set_transaction_tags",
            value: "debt",
          },
        ],
      }),
    ]);

    const proposal = await hook.process(
      {
        id: "p1",
        importId: "bank:1",
        transaction: tx(),
        suggestions: [],
        status: "needs-review",
        issues: [],
      },
      { availableAccounts: [], history: [] },
    );

    expect(proposal.transaction).toMatchObject({
      narration: "Debt repayment",
      tags: ["debt"],
    });
    expect(proposal.selectedAccount).toBe("Expenses:Debt:Loan");
  });

  test("parseRulesFile and summarizeRule", () => {
    const file = parseRulesFile({
      version: 1,
      rules: [rule({ id: "r1" })],
    });
    expect(file.rules).toHaveLength(1);
    expect(summarizeRule(file.rules[0]).for).toBe(
      "All past and future transactions",
    );
    expect(ruleBlockedCount(10, 3)).toBe(7);
  });

  test("retains target-aware rule run audit fields and tolerates historical runs", () => {
    expect(
      parseRuleRun({
        id: "run-1",
        ruleName: "Plata",
        target: "live-ledger",
        transactionsQueued: 2,
        targetCounts: {
          queued: { pendingImports: 0, liveLedger: 2 },
          processed: { pendingImports: 0, liveLedger: 2 },
          modified: { pendingImports: 0, liveLedger: 1 },
        },
      }),
    ).toMatchObject({
      target: "live-ledger",
      targetCounts: {
        queued: { pendingImports: 0, liveLedger: 2 },
      },
    });
    expect(
      parseRuleRun({ id: "legacy", ruleName: "Legacy rule" })?.target,
    ).toBeUndefined();
  });
});
