<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type {
    DetectionRule,
    RuleRegistryMeta,
    RuleRun,
  } from "@beancount-js/beangulp";
  import RulesSettings from "./RulesSettings.svelte";

  const { Story } = defineMeta({
    title: "Pages/RulesSettings",
    component: RulesSettings,
    parameters: {
      layout: "fullscreen",
    },
  });

  const sampleRules: DetectionRule[] = [
    {
      id: "rule-food",
      name: "Food categorization",
      resourceType: "transaction" as const,
      active: true,
      effectiveDate: null,
      conditions: [
        {
          id: "c-merchant",
          conditionType: "transaction_merchant" as const,
          operator: "=",
          value: "Whole Foods",
        },
      ],
      actions: [
        {
          id: "a-category",
          actionType: "set_transaction_category" as const,
          value: "Expenses:Food",
        },
      ],
    },
    {
      id: "rule-invoice",
      name: "Invoice cleanup",
      resourceType: "transaction" as const,
      active: false,
      effectiveDate: null,
      conditions: [
        {
          id: "c-name",
          conditionType: "transaction_name" as const,
          operator: "=",
          value: "Invoice",
        },
      ],
      actions: [
        {
          id: "a-tag",
          actionType: "set_transaction_tags" as const,
          value: '["work"]',
        },
      ],
    },
  ];

  const sampleRegistry: RuleRegistryMeta = {
    filters: [
      {
        type: "text" as const,
        key: "transaction_name" as const,
        label: "Transaction name",
        operators: [{ label: "Contains", value: "like" }],
      },
      {
        type: "text" as const,
        key: "transaction_merchant" as const,
        label: "Transaction merchant",
        operators: [{ label: "Equal to", value: "=" }],
      },
    ],
    executors: [
      {
        type: "select" as const,
        key: "set_transaction_category" as const,
        label: "Set transaction category",
        options: [
          { value: "Expenses:Food", label: "Expenses:Food" },
          { value: "Expenses:Work", label: "Expenses:Work" },
        ],
      },
      {
        type: "tags" as const,
        key: "set_transaction_tags" as const,
        label: "Set transaction tags",
        options: [
          { value: "work", label: "work" },
          { value: "personal", label: "personal" },
        ],
      },
    ],
  };

  const sampleRuns: RuleRun[] = [
    {
      id: "run-1",
      ruleId: "rule-food",
      ruleName: "Food categorization",
      executionType: "manual",
      status: "success",
      executedAt: "2026-07-25T12:00:00.000Z",
      target: "live-ledger",
      transactionsQueued: 12,
      transactionsProcessed: 12,
      transactionsModified: 8,
      transactionsBlocked: 0,
    },
    {
      id: "run-2",
      ruleId: "rule-invoice",
      ruleName: "Invoice cleanup",
      executionType: "manual",
      status: "failed",
      executedAt: "2026-07-24T10:15:00.000Z",
      target: "pending-imports",
      transactionsQueued: 4,
      transactionsProcessed: 4,
      transactionsModified: 0,
      transactionsBlocked: 4,
      errorMessage: "Manual verification required for conflicting rules.",
    },
  ];
</script>

<Story name="Default">
  {#snippet template()}
    <div class="h-[40rem] bg-background p-4">
      <RulesSettings
        hasProject
        rules={sampleRules}
        runs={sampleRuns}
        runsOffset={0}
        runsTotal={sampleRuns.length}
        registry={sampleRegistry}
        accounts={[
          "Assets:Cash",
          "Expenses:Food",
          "Assets:Bank:Checking",
        ]}
      />
    </div>
  {/snippet}
</Story>
