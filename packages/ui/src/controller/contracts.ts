import type { ProjectSnapshot, ProjectSummary } from "@beancount-js/workspace";
import type { Conversion } from "@beancount-js/beancount";
import type { ComponentContext } from "../domain/context";
import type { LedgerData } from "../domain/core/ledger";
import type { DateTime } from "luxon";
export type BeancountStatus =
  | "idle"
  | "loading"
  | "refreshing"
  | "ready"
  | "empty"
  | "failed";
export interface BeancountRoute {
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
}
export type SidebarMode = "projects" | "workspace" | "search";
export type WorkspaceView = "ledgers" | "folders" | "tags";
export type SidebarTree = "files" | "folders" | "tags";
export interface BeancountSidebarState {
  readonly mode: SidebarMode;
  readonly view: WorkspaceView;
  readonly tagsView: "tree" | "flat";
  readonly searches: Readonly<Record<WorkspaceView, string>>;
  readonly expanded: Readonly<
    Record<SidebarTree, Readonly<Record<string, boolean>>>
  >;
  readonly selectedTags: readonly string[];
  readonly settings: boolean;
  readonly settingsGroups: Readonly<Record<"import" | "review", boolean>>;
  readonly projectFormOpen: boolean;
  readonly projectPath: string;
  readonly projectOpening: boolean;
  readonly projectError: string;
}
export interface BeancountSidebarActions {
  setMode(mode: SidebarMode): void;
  setView(view: WorkspaceView): void;
  setTagsView(view: "tree" | "flat"): void;
  setSearch(view: WorkspaceView, query: string): void;
  setExpanded(tree: SidebarTree, id: string, expanded: boolean): void;
  setExpandedNodes(
    tree: SidebarTree,
    nodes: Readonly<Record<string, boolean>>,
  ): void;
  toggleSettingsGroup(group: "import" | "review"): void;
  beginProjectOpen(): void;
  setProjectPath(path: string): void;
  cancelProjectOpen(): void;
}
export interface BeancountDataSource {
  addProject?(
    path?: string,
    signal?: AbortSignal,
  ): Promise<ProjectSnapshot | null>;
  listProjects(signal?: AbortSignal): Promise<ProjectSummary[]>;
  loadProject(id: string, signal?: AbortSignal): Promise<ProjectSnapshot>;
  request?(url: string, init?: RequestInit): Promise<Response>;
  resourceUrl?(
    projectId: string,
    path: string,
  ): Promise<{
    url: string;
    mimeType: string;
    text?: string;
    revoke?: () => void;
  }>;
  saveFile(
    projectId: string,
    path: string,
    contents: string,
    expectedRevision?: string,
    signal?: AbortSignal,
  ): Promise<ProjectSnapshot>;
}
export interface BeancountControllerState {
  readonly route: BeancountRoute;
  readonly sidebar: BeancountSidebarState;
  readonly canAddProject: boolean;
  readonly projects: readonly ProjectSummary[];
  readonly snapshot: ProjectSnapshot | undefined;
  readonly activeFile: string;
  readonly ledger: LedgerData;
  readonly status: BeancountStatus;
  readonly error: string;
  readonly canNavigateBack: boolean;
  readonly canNavigateForward: boolean;
}
export interface BeancountControllerActions {
  readonly sidebar: BeancountSidebarActions;
  addProject(path?: string): Promise<void>;
  openSettings(path?: string): void;
  returnFromSettings(): void;
  selectTags(tags: readonly string[]): void;
  request(url: string, init?: RequestInit): Promise<Response>;
  resourceUrl(path: string): Promise<{
    url: string;
    mimeType: string;
    text?: string;
    revoke?: () => void;
  }>;
  navigate(path: string, options?: { replace?: boolean }): void;
  back(): void;
  forward(): void;
  selectProject(id: string): Promise<void>;
  selectFile(path: string, route?: string): void;
  setQuery(query: string): void;
  setConversion(conversion: Conversion): void;
  saveFile(
    path: string,
    contents: string,
    expectedRevision?: string,
  ): Promise<void>;
  refresh(): Promise<void>;
  retry(): Promise<void>;
}
export interface BeancountController {
  readonly state: BeancountControllerState;
  readonly actions: BeancountControllerActions;
  readonly presentation: ComponentContext;
  readonly services: {
    sync: ReturnType<
      typeof import("../domain/ingestion/sync").createIngestionSync
    >;
    syncStatus: ReturnType<
      typeof import("../domain/studio/sync-status").createSyncStatus
    >;
  };
  readonly workspace: import("../domain/studio/workspace").StudioWorkspaceContext;
  readonly navigation: ReturnType<
    typeof import("../domain/router/router").createControllerNavigation
  >;
  readonly clock: () => DateTime;
  initialize(): Promise<void>;
  dispose(): void;
}
export interface BeancountControllerOptions {
  source: BeancountDataSource;
  initialRoute?: string;
  clock?: () => DateTime;
}
