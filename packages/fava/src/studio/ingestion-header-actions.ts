import { writable } from "svelte/store";

export type IngestionEditorHeaderActions = {
  kind: "editor";
  saveHint: string;
  configReady: boolean;
  sectionsCollapsedAll: boolean;
  yamlMode: boolean;
  /** True = connection preview, false = full editor */
  previewMode: boolean;
  onToggleCollapse: () => void;
  onYamlMode: (pressed: boolean) => void;
  onTogglePreview: () => void;
  onReviewImports: () => void;
};

export type IngestionReviewHeaderActions = {
  kind: "review";
  sourceId: string;
  sourceOptions: { value: string; label: string }[];
  canForceRefetch: boolean;
  canRerunAi: boolean;
  aiRerunBusy: boolean;
  groupsCollapsedAll: boolean;
  canAccept: boolean;
  acceptCount: number;
  acceptBusy: boolean;
  onSourceChange: (sourceId: string) => void;
  onToggleCollapseGroups: () => void;
  onOpenAccounts: () => void;
  onOpenMerchants: () => void;
  onForceRefetch: () => void;
  onRerunAi: () => void;
  onEditSources: () => void;
  onAccept: () => void;
  onReviewMerchants: () => void;
};

export type IngestionMerchantsHeaderActions = {
  kind: "merchants";
  sourceId: string;
  sourceOptions: { value: string; label: string }[];
  groupsCollapsedAll: boolean;
  canDetect: boolean;
  detectBusy: boolean;
  onSourceChange: (sourceId: string) => void;
  onToggleCollapseGroups: () => void;
  onDetectMerchants: () => void;
  onReviewImports: () => void;
  onOpenAccounts: () => void;
  onEditSources: () => void;
};

/** Rules settings controls in the workspace header. */
export type IngestionRulesHeaderActions = {
  kind: "rules";
  saveHint: string;
  ruleCount: number;
  sortKey: "name" | "active";
  canApplyAll: boolean;
  applyBusy: boolean;
  onSortChange: (sortKey: "name" | "active") => void;
  onApplyAll: () => void;
  onAddRule: () => void;
};

export type IngestionHeaderActions =
  | IngestionEditorHeaderActions
  | IngestionReviewHeaderActions
  | IngestionMerchantsHeaderActions
  | IngestionRulesHeaderActions;

/** Ingestion controls rendered in `studio-workspace-header`. */
export const ingestionHeaderActions = writable<IngestionHeaderActions | null>(
  null,
);
