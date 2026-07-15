import { getContext, setContext } from "svelte";
import { writable, type Writable } from "svelte/store";
import type { ProjectSnapshot } from "@beancount-js/workspace";

export type InlineAiRequest = {
  path: string;
  text: string;
  fromLine: number;
  toLine: number;
};

export type LedgerSidebarMode = "workspace" | "settings";

export interface StudioWorkspaceContext {
  snapshot: Writable<ProjectSnapshot | undefined>;
  activeFile: Writable<string>;
  ledgerSidebarMode: Writable<LedgerSidebarMode>;
  saveFile: (path: string, contents: string) => Promise<void>;
  resourceUrl: (path: string) => Promise<{ url: string; mimeType: string; revoke?: () => void }>;
  requestInlineAi: (request: InlineAiRequest) => void;
}

const StudioWorkspaceKey = Symbol("beancount-studio-workspace");

export function createStudioWorkspace(
  saveFile: StudioWorkspaceContext["saveFile"],
  resourceUrl: StudioWorkspaceContext["resourceUrl"],
  requestInlineAi: StudioWorkspaceContext["requestInlineAi"],
) {
  return {
    snapshot: writable<ProjectSnapshot | undefined>(),
    activeFile: writable(""),
    ledgerSidebarMode: writable<LedgerSidebarMode>("workspace"),
    saveFile,
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
