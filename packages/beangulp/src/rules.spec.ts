import { describe, expect, test } from "vitest";
import type { NormalizedTransaction } from "./types";
import {
  RuleCategorizer,
  RuleActionsHook,
  applyRuleActions,
  firstCategoryMatch,
  migrateMerchantRules,
  parseRulesFile,
  ruleBlockedCount,
  ruleMatches,
  summarizeRule,
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

function rule(partial: Partial<DetectionRule> & Pick<DetectionRule, "id">): DetectionRule {
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
});
