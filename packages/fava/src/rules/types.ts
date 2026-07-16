import type {
  DetectionRule,
  RuleRegistryMeta,
  RuleRun,
} from "@beancount-js/beangulp";

export interface RulesResponse {
  version: 1;
  rules: DetectionRule[];
  registry: RuleRegistryMeta;
  accounts: string[];
}

export interface RuleRunsResponse {
  runs: RuleRun[];
  total: number;
  offset: number;
  limit: number;
}

export interface RuleApplyPreviewEntry {
  ruleId: string;
  ruleName: string;
  proposals: number;
  ledger: number;
  total: number;
}

export interface RuleApplyPreviewResponse {
  preview: RuleApplyPreviewEntry[];
}

export interface RuleApplyResultEntry {
  ruleId: string;
  ruleName: string;
  runId: string;
  status: "success" | "failed";
  queued: number;
  processed: number;
  modified: number;
  blocked: number;
  errorMessage?: string | null;
}

export interface RuleApplyResponse {
  results: RuleApplyResultEntry[];
}

export type { DetectionRule, RuleRegistryMeta, RuleRun };
