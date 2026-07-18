import type {
  CategorizationContext,
  CategorizerPlugin,
  CategorySuggestion,
  ImportProposal,
  MerchantIdentity,
  NormalizedTransaction,
  PipelineContext,
  ProposalHook,
} from "./types";
import {
  normalizeMerchant,
  type MerchantRule,
} from "./categorize";

export type RuleConditionType =
  | "compound"
  | "transaction_name"
  | "transaction_amount"
  | "transaction_type"
  | "transaction_merchant"
  | "transaction_account";

export type RuleActionType =
  | "set_transaction_category"
  | "set_transaction_tags"
  | "set_transaction_merchant"
  | "set_transaction_name"
  | "exclude_transaction";

export type RuleOperator =
  | "like"
  | "="
  | "is_null"
  | ">"
  | ">="
  | "<"
  | "<="
  | "and"
  | "or";

export interface RuleCondition {
  id: string;
  conditionType: RuleConditionType;
  operator: string;
  value: string | null;
  subConditions?: RuleCondition[];
}

export interface RuleAction {
  id: string;
  actionType: RuleActionType;
  value: string | null;
}

export interface DetectionRule {
  id: string;
  name?: string | null;
  resourceType: "transaction";
  active: boolean;
  /** null = all past and future; ISO date = starting from */
  effectiveDate: string | null;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export interface RulesFile {
  version: 1;
  rules: DetectionRule[];
}

export type RuleRunExecutionType = "manual" | "scheduled";
export type RuleRunStatus = "pending" | "success" | "failed";
export type RuleApplyTarget = "pending-imports" | "live-ledger" | "both";

export interface RuleRunTargetCounts {
  pendingImports: number;
  liveLedger: number;
}

export interface RuleRun {
  id: string;
  ruleId: string | null;
  ruleName: string;
  executionType: RuleRunExecutionType;
  /** Scope selected for this manual run. Historical runs predate this field. */
  target?: RuleApplyTarget;
  status: RuleRunStatus;
  executedAt: string;
  transactionsQueued: number;
  transactionsProcessed: number;
  transactionsModified: number;
  transactionsBlocked: number;
  /** Counts split by the selected target, recorded for new target-aware runs. */
  targetCounts?: {
    queued: RuleRunTargetCounts;
    processed: RuleRunTargetCounts;
    modified: RuleRunTargetCounts;
  };
  errorMessage?: string | null;
}

export interface RuleRunsFile {
  version: 1;
  runs: RuleRun[];
}

export interface RuleEvaluationContext {
  transaction: NormalizedTransaction;
  merchant?: MerchantIdentity;
  /** Optional ISO date of the transaction for FOR / effectiveDate checks. */
  bookedAt?: string;
}

export interface RulePatch {
  selectedAccount?: string;
  narration?: string;
  merchant?: string;
  tags?: string[];
  exclude?: boolean;
  ruleId?: string;
  ruleName?: string;
}

export interface RuleFilterOption {
  value: string;
  label: string;
}

export interface RuleConditionFilterMeta {
  type: "text" | "number" | "select";
  key: RuleConditionType;
  label: string;
  operators: Array<{ label: string; value: string }>;
  options?: RuleFilterOption[];
}

export interface RuleActionExecutorMeta {
  type: "select" | "text" | "function" | "tags";
  key: RuleActionType;
  label: string;
  options?: RuleFilterOption[];
}

export interface RuleRegistryMeta {
  filters: RuleConditionFilterMeta[];
  executors: RuleActionExecutorMeta[];
}

const TEXT_OPERATORS = [
  { label: "Contains", value: "like" },
  { label: "Equal to", value: "=" },
  { label: "Is empty", value: "is_null" },
] as const;

const NUMBER_OPERATORS = [
  { label: "Greater than", value: ">" },
  { label: "Greater or equal to", value: ">=" },
  { label: "Less than", value: "<" },
  { label: "Less than or equal to", value: "<=" },
  { label: "Is equal to", value: "=" },
] as const;

const SELECT_OPERATORS = [
  { label: "Equal to", value: "=" },
  { label: "Is empty", value: "is_null" },
] as const;

export function newRuleId() {
  return crypto.randomUUID();
}

export function emptyRulesFile(): RulesFile {
  return { version: 1, rules: [] };
}

export function emptyRuleRunsFile(): RuleRunsFile {
  return { version: 1, runs: [] };
}

export function ruleBlockedCount(processed: number, modified: number) {
  return Math.max(processed - modified, 0);
}

export function createRuleRegistry(options?: {
  accounts?: readonly string[];
  merchants?: readonly RuleFilterOption[];
}): RuleRegistryMeta {
  const accountOptions = (options?.accounts ?? []).map((account) => ({
    value: account,
    label: account,
  }));
  return {
    filters: [
      {
        type: "text",
        key: "transaction_name",
        label: "Transaction name",
        operators: [...TEXT_OPERATORS],
      },
      {
        type: "number",
        key: "transaction_amount",
        label: "Transaction amount",
        operators: [...NUMBER_OPERATORS],
      },
      {
        type: "select",
        key: "transaction_type",
        label: "Transaction type",
        operators: [{ label: "Equal to", value: "=" }],
        options: [
          { value: "expense", label: "Expense" },
          { value: "income", label: "Income" },
        ],
      },
      {
        type: "select",
        key: "transaction_merchant",
        label: "Transaction merchant",
        operators: [...SELECT_OPERATORS],
        options: options?.merchants ? [...options.merchants] : undefined,
      },
      {
        type: "select",
        key: "transaction_account",
        label: "Transaction account",
        operators: [...SELECT_OPERATORS],
        options: accountOptions,
      },
    ],
    executors: [
      {
        type: "select",
        key: "set_transaction_category",
        label: "Set transaction category",
        options: accountOptions,
      },
      {
        type: "tags",
        key: "set_transaction_tags",
        label: "Set transaction tags",
      },
      {
        type: "text",
        key: "set_transaction_merchant",
        label: "Set transaction merchant",
      },
      {
        type: "text",
        key: "set_transaction_name",
        label: "Set transaction name",
      },
      {
        type: "function",
        key: "exclude_transaction",
        label: "Exclude transaction",
      },
    ],
  };
}

function direction(amount: string) {
  return amount.trim().startsWith("-") ? "debit" : "credit";
}

function transactionType(amount: string) {
  return direction(amount) === "debit" ? "expense" : "income";
}

function merchantLabel(context: RuleEvaluationContext) {
  return (
    context.merchant?.canonicalName ??
    context.transaction.merchant ??
    context.transaction.payee ??
    context.transaction.narration
  );
}

function normalizeWhitespace(value: string) {
  return value.replaceAll(/\s+/g, " ").trim();
}

function absAmount(amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return Math.abs(Number(amount.replace(/^-/, "")));
  return Math.abs(value);
}

function compareText(
  actual: string | undefined,
  operator: string,
  expected: string | null,
) {
  if (operator === "is_null") return !actual || actual.trim() === "";
  const left = normalizeWhitespace(actual ?? "").toLowerCase();
  const right = normalizeWhitespace(expected ?? "").toLowerCase();
  if (operator === "=") return left === right;
  if (operator === "like") return left.includes(right);
  return false;
}

function compareNumber(
  actual: number,
  operator: string,
  expected: string | null,
) {
  const right = Number(expected);
  if (!Number.isFinite(right)) return false;
  if (operator === "=") return actual === right;
  if (operator === ">") return actual > right;
  if (operator === ">=") return actual >= right;
  if (operator === "<") return actual < right;
  if (operator === "<=") return actual <= right;
  return false;
}

function evaluateLeafCondition(
  condition: RuleCondition,
  context: RuleEvaluationContext,
): boolean {
  const tx = context.transaction;
  switch (condition.conditionType) {
    case "transaction_name":
      return compareText(tx.narration, condition.operator, condition.value);
    case "transaction_amount":
      return compareNumber(
        absAmount(tx.amount),
        condition.operator,
        condition.value,
      );
    case "transaction_type": {
      if (condition.operator !== "=") return false;
      const expected = (condition.value ?? "").toLowerCase();
      const actual = transactionType(tx.amount);
      if (expected === "debit" || expected === "expense")
        return actual === "expense";
      if (expected === "credit" || expected === "income")
        return actual === "income";
      return actual === expected;
    }
    case "transaction_merchant": {
      if (condition.operator === "is_null") {
        return !merchantLabel(context)?.trim();
      }
      const value = condition.value ?? "";
      if (value.startsWith("merchantId:")) {
        const merchantId = value.slice("merchantId:".length);
        return (
          condition.operator === "=" &&
          Boolean(merchantId) &&
          context.merchant?.merchantId === merchantId
        );
      }
      return compareText(merchantLabel(context), condition.operator, value);
    }
    case "transaction_account":
      return compareText(tx.sourceAccount, condition.operator, condition.value);
    default:
      return false;
  }
}

export function evaluateCondition(
  condition: RuleCondition,
  context: RuleEvaluationContext,
): boolean {
  if (condition.conditionType === "compound") {
    const subs = condition.subConditions ?? [];
    if (subs.length === 0) return true;
    if (condition.operator === "or") {
      return subs.some((sub) => evaluateCondition(sub, context));
    }
    return subs.every((sub) => evaluateCondition(sub, context));
  }
  return evaluateLeafCondition(condition, context);
}

export function ruleAppliesOnDate(
  rule: DetectionRule,
  bookedAt: string | undefined,
) {
  if (!rule.effectiveDate) return true;
  if (!bookedAt) return true;
  return bookedAt >= rule.effectiveDate;
}

export function ruleMatches(
  rule: DetectionRule,
  context: RuleEvaluationContext,
): boolean {
  if (!rule.active) return false;
  if (!ruleAppliesOnDate(rule, context.bookedAt ?? context.transaction.bookedAt))
    return false;
  if (rule.conditions.length === 0) return false;
  return rule.conditions.every((condition) =>
    evaluateCondition(condition, context),
  );
}

function parseTags(value: string | null): string[] {
  if (!value?.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string")
          .map((tag) => tag.trim())
          .filter(Boolean);
      }
    } catch {
      // fall through to comma-separated
    }
  }
  return trimmed
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function applyRuleActions(
  rule: DetectionRule,
  context: RuleEvaluationContext,
): RulePatch | undefined {
  if (!ruleMatches(rule, context)) return undefined;
  const patch: RulePatch = {
    ruleId: rule.id,
    ruleName: rule.name ?? undefined,
  };
  let applied = false;
  for (const action of rule.actions) {
    switch (action.actionType) {
      case "set_transaction_category":
        if (action.value?.trim()) {
          patch.selectedAccount = action.value.trim();
          applied = true;
        }
        break;
      case "set_transaction_tags": {
        const tags = parseTags(action.value);
        if (tags.length > 0) {
          const existing = context.transaction.tags ?? [];
          patch.tags = [...new Set([...existing, ...tags])];
          applied = true;
        }
        break;
      }
      case "set_transaction_merchant":
        if (action.value != null) {
          patch.merchant = action.value;
          applied = true;
        }
        break;
      case "set_transaction_name":
        if (action.value != null) {
          patch.narration = action.value;
          applied = true;
        }
        break;
      case "exclude_transaction":
        patch.exclude = true;
        applied = true;
        break;
    }
  }
  return applied ? patch : undefined;
}

/** First matching active rule that sets a category (first-match-wins). */
export function firstCategoryMatch(
  rules: readonly DetectionRule[],
  context: RuleEvaluationContext,
): { rule: DetectionRule; account: string } | undefined {
  for (const rule of rules) {
    if (!ruleMatches(rule, context)) continue;
    const action = rule.actions.find(
      (item) =>
        item.actionType === "set_transaction_category" && item.value?.trim(),
    );
    if (!action?.value) continue;
    return { rule, account: action.value.trim() };
  }
  return undefined;
}

export function migrateMerchantRules(
  rules: readonly MerchantRule[],
): DetectionRule[] {
  return rules.map((rule) => {
    const conditions: RuleCondition[] = [];
    if (rule.merchantId) {
      conditions.push({
        id: newRuleId(),
        conditionType: "transaction_merchant",
        operator: "=",
        value: `merchantId:${rule.merchantId}`,
      });
    } else if (rule.merchant) {
      conditions.push({
        id: newRuleId(),
        conditionType: "transaction_merchant",
        operator: "=",
        value: rule.merchant,
      });
    }
    if (rule.sourceAccount) {
      conditions.push({
        id: newRuleId(),
        conditionType: "transaction_account",
        operator: "=",
        value: rule.sourceAccount,
      });
    }
    if (rule.direction) {
      conditions.push({
        id: newRuleId(),
        conditionType: "transaction_type",
        operator: "=",
        value: rule.direction === "debit" ? "expense" : "income",
      });
    }
    return {
      id: newRuleId(),
      name: rule.merchant ?? rule.merchantId ?? "Migrated rule",
      resourceType: "transaction" as const,
      active: true,
      effectiveDate: null,
      conditions,
      actions: [
        {
          id: newRuleId(),
          actionType: "set_transaction_category" as const,
          value: rule.account,
        },
      ],
    };
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCondition(raw: unknown): RuleCondition | undefined {
  if (!isObject(raw)) return undefined;
  const conditionType = raw.conditionType ?? raw.condition_type;
  const operator = raw.operator;
  if (typeof conditionType !== "string" || typeof operator !== "string")
    return undefined;
  const subRaw = raw.subConditions ?? raw.sub_conditions;
  const subConditions = Array.isArray(subRaw)
    ? subRaw
        .map(parseCondition)
        .filter((item): item is RuleCondition => Boolean(item))
    : undefined;
  return {
    id: typeof raw.id === "string" ? raw.id : newRuleId(),
    conditionType: conditionType as RuleConditionType,
    operator,
    value:
      raw.value === null || typeof raw.value === "string" ? raw.value : null,
    ...(subConditions ? { subConditions } : {}),
  };
}

function parseAction(raw: unknown): RuleAction | undefined {
  if (!isObject(raw)) return undefined;
  const actionType = raw.actionType ?? raw.action_type;
  if (typeof actionType !== "string") return undefined;
  return {
    id: typeof raw.id === "string" ? raw.id : newRuleId(),
    actionType: actionType as RuleActionType,
    value:
      raw.value === null || typeof raw.value === "string" ? raw.value : null,
  };
}

export function parseDetectionRule(raw: unknown): DetectionRule | undefined {
  if (!isObject(raw)) return undefined;
  const conditionsRaw = raw.conditions;
  const actionsRaw = raw.actions;
  if (!Array.isArray(conditionsRaw) || !Array.isArray(actionsRaw))
    return undefined;
  const conditions = conditionsRaw
    .map(parseCondition)
    .filter((item): item is RuleCondition => Boolean(item));
  const actions = actionsRaw
    .map(parseAction)
    .filter((item): item is RuleAction => Boolean(item));
  if (actions.length === 0) return undefined;
  const effective =
    raw.effectiveDate === null ||
    raw.effective_date === null ||
    typeof raw.effectiveDate === "string" ||
    typeof raw.effective_date === "string"
      ? ((raw.effectiveDate ?? raw.effective_date) as string | null)
      : null;
  return {
    id: typeof raw.id === "string" ? raw.id : newRuleId(),
    name:
      raw.name === null || typeof raw.name === "string" ? raw.name : undefined,
    resourceType: "transaction",
    active: raw.active !== false,
    effectiveDate: effective,
    conditions,
    actions,
  };
}

export function parseRulesFile(raw: unknown): RulesFile {
  if (!isObject(raw) || !Array.isArray(raw.rules)) return emptyRulesFile();
  return {
    version: 1,
    rules: raw.rules
      .map(parseDetectionRule)
      .filter((item): item is DetectionRule => Boolean(item)),
  };
}

export function parseRuleRun(raw: unknown): RuleRun | undefined {
  if (!isObject(raw)) return undefined;
  if (typeof raw.ruleName !== "string" && typeof raw.rule_name !== "string")
    return undefined;
  const queued = Number(
    raw.transactionsQueued ?? raw.transactions_queued ?? 0,
  );
  const processed = Number(
    raw.transactionsProcessed ?? raw.transactions_processed ?? 0,
  );
  const modified = Number(
    raw.transactionsModified ?? raw.transactions_modified ?? 0,
  );
  const blocked = Number(
    raw.transactionsBlocked ??
      raw.transactions_blocked ??
      ruleBlockedCount(processed, modified),
  );
  const target =
    raw.target === "pending-imports" ||
    raw.target === "live-ledger" ||
    raw.target === "both"
      ? raw.target
      : undefined;
  const rawTargetCounts = raw.targetCounts;
  const targetCounts = isObject(rawTargetCounts)
    ? {
        queued: parseRuleRunTargetCounts(rawTargetCounts.queued),
        processed: parseRuleRunTargetCounts(rawTargetCounts.processed),
        modified: parseRuleRunTargetCounts(rawTargetCounts.modified),
      }
    : undefined;
  return {
    id: typeof raw.id === "string" ? raw.id : newRuleId(),
    ruleId:
      raw.ruleId === null ||
      typeof raw.ruleId === "string" ||
      raw.rule_id === null ||
      typeof raw.rule_id === "string"
        ? ((raw.ruleId ?? raw.rule_id) as string | null)
        : null,
    ruleName: String(raw.ruleName ?? raw.rule_name),
    executionType:
      raw.executionType === "scheduled" || raw.execution_type === "scheduled"
        ? "scheduled"
        : "manual",
    target,
    status:
      raw.status === "pending" || raw.status === "failed"
        ? raw.status
        : "success",
    executedAt: String(
      raw.executedAt ?? raw.executed_at ?? new Date().toISOString(),
    ),
    transactionsQueued: Number.isFinite(queued) ? queued : 0,
    transactionsProcessed: Number.isFinite(processed) ? processed : 0,
    transactionsModified: Number.isFinite(modified) ? modified : 0,
    transactionsBlocked: Number.isFinite(blocked)
      ? blocked
      : ruleBlockedCount(processed, modified),
    targetCounts,
    errorMessage:
      raw.errorMessage === null ||
      typeof raw.errorMessage === "string" ||
      raw.error_message === null ||
      typeof raw.error_message === "string"
        ? ((raw.errorMessage ?? raw.error_message) as string | null | undefined)
        : undefined,
  };
}

function parseRuleRunTargetCounts(raw: unknown): RuleRunTargetCounts {
  if (!isObject(raw)) return { pendingImports: 0, liveLedger: 0 };
  const pendingImports = Number(raw.pendingImports ?? 0);
  const liveLedger = Number(raw.liveLedger ?? 0);
  return {
    pendingImports: Number.isFinite(pendingImports) ? pendingImports : 0,
    liveLedger: Number.isFinite(liveLedger) ? liveLedger : 0,
  };
}

export function parseRuleRunsFile(raw: unknown): RuleRunsFile {
  if (!isObject(raw) || !Array.isArray(raw.runs)) return emptyRuleRunsFile();
  return {
    version: 1,
    runs: raw.runs
      .map(parseRuleRun)
      .filter((item): item is RuleRun => Boolean(item)),
  };
}

export function validateDetectionRule(rule: DetectionRule): string[] {
  const errors: string[] = [];
  if (!rule.id) errors.push("Rule id is required.");
  if (rule.actions.length === 0) errors.push("At least one action is required.");
  const actionTypes = new Set<string>();
  for (const action of rule.actions) {
    if (actionTypes.has(action.actionType)) {
      errors.push(`Duplicate action type: ${action.actionType}`);
    }
    actionTypes.add(action.actionType);
    if (
      action.actionType !== "exclude_transaction" &&
      (action.value == null || action.value.trim() === "")
    ) {
      errors.push(`Action ${action.actionType} requires a value.`);
    }
  }
  for (const condition of rule.conditions) {
    if (condition.conditionType === "compound") {
      for (const sub of condition.subConditions ?? []) {
        if (sub.conditionType === "compound") {
          errors.push("Nested compound condition groups are not allowed.");
        }
      }
    } else if (
      condition.operator !== "is_null" &&
      (condition.value == null || condition.value === "")
    ) {
      errors.push(`Condition ${condition.conditionType} requires a value.`);
    }
  }
  return errors;
}

export class RuleCategorizer implements CategorizerPlugin {
  readonly id = "detection-rules";

  constructor(readonly rules: readonly DetectionRule[]) {}

  async suggest(
    context: CategorizationContext,
  ): Promise<readonly CategorySuggestion[]> {
    const match = firstCategoryMatch(this.rules, {
      transaction: context.transaction,
      merchant: context.merchant,
      bookedAt: context.transaction.bookedAt,
    });
    if (!match) return [];
    const label = merchantLabel({
      transaction: context.transaction,
      merchant: context.merchant,
    });
    return [
      {
        account: match.account,
        rawScore: 1,
        scoreKind: "rule-certainty",
        support: 1,
        hard: true,
        method: "rule",
        explanation: `Categorised as ${match.account} by rule${match.rule.name ? ` "${match.rule.name}"` : ""}${label ? ` for ${label}` : ""}.`,
        evidence: [
          {
            id: `rule:${match.rule.id}:${match.account}`,
            kind: "rule",
            summary: match.rule.name
              ? `Detection rule ${match.rule.name}`
              : `Detection rule ${match.rule.id}`,
          },
        ],
      },
    ];
  }
}

/** Apply non-category rule actions (tags, name, merchant, exclude) to proposals. */
export class RuleActionsHook implements ProposalHook {
  constructor(readonly rules: readonly DetectionRule[]) {}

  async process(
    proposal: ImportProposal,
    _context: PipelineContext,
  ): Promise<ImportProposal> {
    if (!proposal.transaction) return proposal;
    if (
      proposal.status === "duplicate" ||
      proposal.status === "invalid" ||
      proposal.status === "accepted" ||
      proposal.status === "excluded"
    ) {
      return proposal;
    }
    const evalContext: RuleEvaluationContext = {
      transaction: proposal.transaction,
      merchant:
        proposal.merchantResolution?.status === "confirmed"
          ? proposal.merchantResolution.merchant
          : undefined,
      bookedAt: proposal.transaction.bookedAt,
    };
    let next = proposal;
    for (const rule of this.rules) {
      const patch = applyRuleActions(rule, {
        ...evalContext,
        transaction: next.transaction!,
      });
      if (!patch) continue;
      const transaction = { ...next.transaction! };
      if (patch.narration !== undefined) transaction.narration = patch.narration;
      if (patch.merchant !== undefined) transaction.merchant = patch.merchant;
      if (patch.tags) transaction.tags = patch.tags;
      next = {
        ...next,
        transaction,
        selectedAccount: patch.selectedAccount ?? next.selectedAccount,
        status: patch.exclude ? "excluded" : next.status,
      };
      evalContext.transaction = transaction;
    }
    return next;
  }
}

/** Summarize IF/THEN/FOR for list UI pills. */
export function summarizeRule(rule: DetectionRule) {
  const ifParts = rule.conditions.map(summarizeCondition).filter(Boolean);
  const thenParts = rule.actions.map(summarizeAction).filter(Boolean);
  const forPart = rule.effectiveDate
    ? `Starting from ${rule.effectiveDate}`
    : "All past and future transactions";
  return {
    if: ifParts.join(" and ") || "No conditions",
    then: thenParts.join(", ") || "No actions",
    for: forPart,
  };
}

function summarizeCondition(condition: RuleCondition): string {
  if (condition.conditionType === "compound") {
    const joiner = condition.operator === "or" ? " or " : " and ";
    const parts = (condition.subConditions ?? [])
      .map(summarizeCondition)
      .filter(Boolean);
    return parts.length ? `(${parts.join(joiner)})` : "";
  }
  const field = condition.conditionType.replaceAll("transaction_", "");
  if (condition.operator === "is_null") return `${field} is empty`;
  if (condition.operator === "like")
    return `${field} like ${condition.value ?? ""}`;
  return `${field} ${condition.operator} ${condition.value ?? ""}`;
}

function summarizeAction(action: RuleAction): string {
  switch (action.actionType) {
    case "set_transaction_category":
      return `Set transaction category to ${action.value ?? ""}`;
    case "set_transaction_tags":
      return `Set transaction tags to ${action.value ?? ""}`;
    case "set_transaction_merchant":
      return `Set transaction merchant to ${action.value ?? ""}`;
    case "set_transaction_name":
      return `Set transaction name to ${action.value ?? ""}`;
    case "exclude_transaction":
      return "Exclude transaction";
  }
}

export function contextFromCategorization(
  context: CategorizationContext,
): RuleEvaluationContext {
  return {
    transaction: context.transaction,
    merchant: context.merchant,
    bookedAt: context.transaction.bookedAt,
  };
}

export { normalizeMerchant, direction as transactionDirection };
