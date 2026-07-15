import { writable } from "svelte/store";

export type IngestionHeaderActions = {
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

/** Sources editor controls rendered in `studio-workspace-header`. */
export const ingestionHeaderActions =
  writable<IngestionHeaderActions | null>(null);
