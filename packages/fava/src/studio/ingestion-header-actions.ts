import { writable } from "svelte/store";

export type IngestionEditorHeaderActions = {
  kind: "editor";
  saveHint: string;
  configReady: boolean;
  sectionsCollapsedAll: boolean;
  yamlMode: boolean;
  /** True = connection preview, false = full editor */
  previewMode: boolean;
  canSyncAll: boolean;
  syncAllBusy: boolean;
  onToggleCollapse: () => void;
  onYamlMode: (pressed: boolean) => void;
  onTogglePreview: () => void;
  onSyncAll: () => void;
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
  bulkAction?: IngestionBulkReviewAction;
  canOpenLedger: boolean;
  onSourceChange: (sourceId: string) => void;
  onToggleCollapseGroups: () => void;
  onOpenAccounts: () => void;
  onOpenMerchants: () => void;
  onForceRefetch: () => void;
  onRerunAi: () => void;
  onEditSources: () => void;
  onAccept: () => void;
  onOpenLedger: () => void;
  onReviewMerchants: () => void;
};

export type IngestionBulkReviewAction = {
  label: string;
  selectedCount: number;
  canRun: boolean;
  busy: boolean;
  onRun: () => void;
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
  canApplyAll: boolean;
  applyBusy: boolean;
  onApplyAll: () => void;
  onAddRule: () => void;
};

/** Manage merchants catalog count in the workspace header. */
export type IngestionManageMerchantsHeaderActions = {
  kind: "manage-merchants";
  merchantCount: number;
  backfillBusy: boolean;
  onBackfill: () => void;
};

/** Import history count in the workspace header. */
export type IngestionHistoryHeaderActions = {
  kind: "history";
  runCount: number;
  sourceId: string;
  sourceOptions: { value: string; label: string }[];
  onSourceChange: (sourceId: string) => void;
};

/** Account-linking actions in the workspace header. */
export type IngestionAccountsHeaderActions = {
  kind: "accounts";
  canSyncAll: boolean;
  syncAllBusy: boolean;
  onSyncAll: () => void;
};

/** Beancount ledger editor File/Edit menubar and Save in the workspace header. */
export type LedgerEditorHeaderActions = {
  kind: "ledger";
  formatOnSave: boolean;
  sources: { path: string }[];
  activePath: string;
  dirty: boolean;
  onOpenSource: (path: string) => void;
  onToggleFormatOnSave: () => void;
  onGotoLine: () => void;
  onFormat: () => void;
  onToggleComment: () => void;
  onUnfoldAll: () => void;
  onFoldAll: () => void;
  onFind: () => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onAskAi: () => void;
  onSave: () => void;
};

/** Per-account activity table bulk actions in the workspace header. */
export type AccountActivityHeaderActions = {
  kind: "account-activity";
  selectedCount: number;
  onReplace: () => void;
};

export type IngestionHeaderActions =
  | IngestionEditorHeaderActions
  | IngestionReviewHeaderActions
  | IngestionMerchantsHeaderActions
  | IngestionManageMerchantsHeaderActions
  | IngestionHistoryHeaderActions
  | IngestionAccountsHeaderActions
  | IngestionRulesHeaderActions
  | LedgerEditorHeaderActions
  | AccountActivityHeaderActions;

/** Ingestion controls rendered in `studio-workspace-header`. */
export const ingestionHeaderActions = writable<IngestionHeaderActions | null>(
  null,
);
