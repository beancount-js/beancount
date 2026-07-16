import { writable } from "svelte/store";

export type IngestionEditorHeaderActions = {
  kind: "editor";
  saveHint: string;
  configReady: boolean;
  sectionsCollapsedAll: boolean;
  yamlMode: boolean;
  /** true = connection preview, false = full editor */
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
  onForceRefetch: () => void;
  onRerunAi: () => void;
  onEditSources: () => void;
  onAccept: () => void;
};

export type IngestionHeaderActions =
  | IngestionEditorHeaderActions
  | IngestionReviewHeaderActions;

/** Ingestion controls rendered in `studio-workspace-header`. */
export const ingestionHeaderActions =
  writable<IngestionHeaderActions | null>(null);
