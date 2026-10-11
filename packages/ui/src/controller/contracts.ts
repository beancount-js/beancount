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
export interface BeancountDataSource {
  listProjects(signal?: AbortSignal): Promise<ProjectSummary[]>;
  loadProject(id: string, signal?: AbortSignal): Promise<ProjectSnapshot>;
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
  navigate(path: string): void;
  back(): void;
  forward(): void;
  selectProject(id: string): Promise<void>;
  selectFile(path: string): void;
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
  readonly clock: () => DateTime;
  initialize(): Promise<void>;
  dispose(): void;
}
export interface BeancountControllerOptions {
  source: BeancountDataSource;
  initialRoute?: string;
  clock?: () => DateTime;
}
