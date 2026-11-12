import { useBeancountController } from "../../controller/context";
import { writable, type Writable } from "svelte/store";
import type { ProjectSnapshot } from "@beancount-js/workspace";
import type { IngestionReviewLedgerSnapshot } from "../ingestion/types";

export type LedgerSidebarMode = "workspace" | "settings";
export type ActiveLedgerKind = "file" | "ingestion-review";

export interface StudioWorkspaceContext {
  headerActions: Writable<
    import("./ingestion-header-actions").IngestionHeaderActions | null
  >;
  queryHistories: Map<
    string,
    Writable<import("../stores/query").QueryHistory[]>
  >;
  snapshot: Writable<ProjectSnapshot | undefined>;
  activeFile: Writable<string>;
  activeLedgerKind: Writable<ActiveLedgerKind>;
  reviewLedger: Writable<IngestionReviewLedgerSnapshot | null>;
  ledgerSidebarMode: Writable<LedgerSidebarMode>;
  saveFile: (
    path: string,
    contents: string,
    expectedRevision?: string,
  ) => Promise<void>;
  refreshSnapshot: () => Promise<ProjectSnapshot>;
  refreshReviewLedger: () => Promise<IngestionReviewLedgerSnapshot | null>;
  resourceUrl: (path: string) => Promise<{
    url: string;
    mimeType: string;
    text?: string;
    revoke?: () => void;
  }>;
}

export function createStudioWorkspace(
  saveFile: StudioWorkspaceContext["saveFile"],
  refreshSnapshot: StudioWorkspaceContext["refreshSnapshot"],
  refreshReviewLedger: StudioWorkspaceContext["refreshReviewLedger"],
  resourceUrl: StudioWorkspaceContext["resourceUrl"],
) {
  return {
    headerActions: writable<
      import("./ingestion-header-actions").IngestionHeaderActions | null
    >(null),
    queryHistories: new Map(),
    snapshot: writable<ProjectSnapshot | undefined>(),
    activeFile: writable(""),
    activeLedgerKind: writable<ActiveLedgerKind>("file"),
    reviewLedger: writable<IngestionReviewLedgerSnapshot | null>(null),
    ledgerSidebarMode: writable<LedgerSidebarMode>("workspace"),
    saveFile,
    refreshSnapshot,
    refreshReviewLedger,
    resourceUrl,
  } satisfies StudioWorkspaceContext;
}

export function useStudioWorkspace() {
  return useBeancountController().workspace;
}
