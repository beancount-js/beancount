import { getContext, setContext } from "svelte";
import { writable, type Writable } from "svelte/store";
import type { ProjectSnapshot } from "@beancount-js/workspace";
import type { IngestionReviewLedgerSnapshot } from "../ingestion/types";

export type InlineAiRequest = {
  path: string;
  text: string;
  fromLine: number;
  toLine: number;
};

export type LedgerSidebarMode = "workspace" | "settings";
export type ActiveLedgerKind = "file" | "ingestion-review";

export interface StudioWorkspaceContext {
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
  resourceUrl: (
    path: string,
  ) => Promise<{ url: string; mimeType: string; revoke?: () => void }>;
  requestInlineAi: (request: InlineAiRequest) => void;
}

const StudioWorkspaceKey = Symbol("beancount-studio-workspace");

export function createStudioWorkspace(
  saveFile: StudioWorkspaceContext["saveFile"],
  refreshSnapshot: StudioWorkspaceContext["refreshSnapshot"],
  refreshReviewLedger: StudioWorkspaceContext["refreshReviewLedger"],
  resourceUrl: StudioWorkspaceContext["resourceUrl"],
  requestInlineAi: StudioWorkspaceContext["requestInlineAi"],
) {
  return {
    snapshot: writable<ProjectSnapshot | undefined>(),
    activeFile: writable(""),
    activeLedgerKind: writable<ActiveLedgerKind>("file"),
    reviewLedger: writable<IngestionReviewLedgerSnapshot | null>(null),
    ledgerSidebarMode: writable<LedgerSidebarMode>("workspace"),
    saveFile,
    refreshSnapshot,
    refreshReviewLedger,
    resourceUrl,
    requestInlineAi,
  } satisfies StudioWorkspaceContext;
}

export function setStudioWorkspace(context: StudioWorkspaceContext) {
  setContext(StudioWorkspaceKey, context);
}

export function useStudioWorkspace() {
  return getContext<StudioWorkspaceContext>(StudioWorkspaceKey);
}
