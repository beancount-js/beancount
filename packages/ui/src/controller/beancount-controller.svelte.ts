import { createIngestionSync } from "../domain/ingestion/sync";
import { createSyncStatus } from "../domain/studio/sync-status";
import { ingestionPath } from "../domain/ingestion/api";
import { createStudioWorkspace } from "../domain/studio/workspace";
import { createControllerNavigation } from "../domain/router/router";
import { get, writable } from "svelte/store";
import { DateTime } from "luxon";
import { createContext } from "../domain/context";
import { LedgerSource } from "../domain/core/ledger";
import { MainNav } from "../domain/menu";
import { parseRoute, isSettingsRoute } from "./routes";
import { createSidebar } from "./sidebar.svelte";
import {
  appendLedgerSearchParams,
  facetsToFilterQuery,
  parseLedgerSearchState,
} from "../domain/lib/ledger-search-state";
import { normalizeLedgerTag } from "../components/navigation/ledger-sidebar";
import type {
  BeancountController,
  BeancountControllerOptions,
  BeancountStatus,
} from "./contracts";
import type { ProjectSnapshot, ProjectSummary } from "@beancount-js/workspace";
export function createBeancountController(
  options: BeancountControllerOptions,
): BeancountController {
  const presentation = createContext();
  presentation.menu.set([MainNav]);
  let projects = $state.raw<ProjectSummary[]>([]);
  let snapshot = $state.raw<ProjectSnapshot>();
  let activeFile = $state("");
  let status = $state<BeancountStatus>("idle");
  let error = $state("");
  let ledger = $state.raw(get(presentation.ledgerData));
  const initialRoute = parseRoute(options.initialRoute ?? "/dashboard");
  type HistoryEntry = {
    route: typeof initialRoute;
    projectId?: string;
    file: string;
  };
  const sidebar = createSidebar();
  const projectCache = new Map<string, ProjectSnapshot>();
  const reviewCache = new Map<
    string,
    import("../domain/ingestion/types").IngestionReviewLedgerSnapshot | null
  >();
  let history = $state.raw<HistoryEntry[]>([{ route: initialRoute, file: "" }]);
  let settingsReturn: HistoryEntry | undefined;
  let index = $state(0);
  const routeStore = writable(initialRoute);
  let inlineAiRequest =
    $state.raw<import("../domain/studio/workspace").InlineAiRequest>();
  function syncRoute() {
    const route = history[index]!.route;
    routeStore.set(route);
    presentation.query.set(
      facetsToFilterQuery(parseLedgerSearchState(route.query)),
    );
    presentation.bqlQuery.set(route.query.qs ?? "");
    sidebar.update({
      settings: isSettingsRoute(route.path),
      selectedTags: parseLedgerSearchState(route.query).tags,
    });
    workspace.ledgerSidebarMode.set(
      isSettingsRoute(route.path) ? "settings" : "workspace",
    );
  }
  let disposed = false;
  let initialized: Promise<void> | undefined;
  let generation = 0;
  const pending = new Set<AbortController>();
  const lifetime = new AbortController();
  const unsubscribe = presentation.ledgerData.subscribe((value) => {
    ledger = value;
  });
  function apply(next: ProjectSnapshot) {
    snapshot = next;
    projectCache.set(next.project.id, next);
    const review = get(workspace.reviewLedger);
    if (
      !next.ledgerFiles.some((file) => file.path === activeFile) &&
      review?.path !== activeFile
    )
      activeFile = next.project.entryFile;
    presentation.ledgerSource.set(
      LedgerSource.fromProject(
        activeFile,
        review?.path === activeFile
          ? [{ path: review.path, contents: review.contents }]
          : next.ledgerFiles,
      ),
    );
    workspace.snapshot.set(next);
    workspace.activeFile.set(activeFile);
    workspace.activeLedgerKind.set(
      review?.path === activeFile ? "ingestion-review" : "file",
    );
    status = next.ledgerFiles.length ? "ready" : "empty";
  }
  async function operate<T>(
    action: (signal: AbortSignal) => Promise<T>,
    accept: (value: T) => void,
  ) {
    if (disposed) throw new Error("Controller has been disposed.");
    const request = new AbortController();
    pending.add(request);
    status = snapshot ? "refreshing" : "loading";
    error = "";
    try {
      const result = await action(request.signal);
      if (!disposed && !request.signal.aborted) accept(result);
    } catch (cause) {
      if (!disposed && !request.signal.aborted) {
        error = cause instanceof Error ? cause.message : String(cause);
        status = "failed";
      }
      throw cause;
    } finally {
      pending.delete(request);
    }
  }
  function currentEntry(route = history[index]!.route): HistoryEntry {
    return { route, projectId: snapshot?.project.id, file: activeFile };
  }
  function remember(entry: HistoryEntry) {
    if (JSON.stringify(entry) === JSON.stringify(history[index])) return;
    if (
      !isSettingsRoute(history[index]!.route.path) &&
      isSettingsRoute(entry.route.path)
    )
      settingsReturn = history[index];
    history = [...history.slice(0, index + 1), entry];
    index++;
    syncRoute();
  }
  function restore(target: number) {
    if (disposed || target < 0 || target >= history.length) return;
    const entry = history[target]!;
    if (snapshot)
      reviewCache.set(snapshot.project.id, get(workspace.reviewLedger));
    const next = entry.projectId
      ? projectCache.get(entry.projectId)
      : undefined;
    if (next) {
      workspace.reviewLedger.set(reviewCache.get(next.project.id) ?? null);
      activeFile = entry.file;
      apply(next);
    }
    index = target;
    syncRoute();
  }
  async function loadProject(id: string, record: boolean, resetFile = true) {
    const version = ++generation;
    await operate(
      (signal) => options.source.loadProject(id, signal),
      (next) => {
        if (version === generation) {
          if (snapshot)
            reviewCache.set(snapshot.project.id, get(workspace.reviewLedger));
          workspace.reviewLedger.set(reviewCache.get(id) ?? null);
          if (resetFile) activeFile = next.project.entryFile;
          apply(next);
          if (record) remember(currentEntry());
          else {
            history = history.map((entry, i) =>
              i === index ? currentEntry() : entry,
            );
            syncRoute();
          }
        }
      },
    );
  }
  async function selectProject(id: string) {
    await loadProject(id, true);
  }
  const actions: BeancountController["actions"] = {
    async request(url, init = {}) {
      if (disposed) throw new Error("Controller has been disposed.");
      if (!options.source.request)
        throw new Error(
          "This data source does not support application services.",
        );
      const request = new AbortController();
      pending.add(request);
      try {
        return await options.source.request(url, {
          ...init,
          signal: AbortSignal.any([
            lifetime.signal,
            request.signal,
            ...(init.signal ? [init.signal] : []),
          ]),
        });
      } finally {
        pending.delete(request);
      }
    },
    async resourceUrl(path) {
      if (disposed) throw new Error("Controller has been disposed.");
      if (!snapshot || !options.source.resourceUrl)
        throw new Error("This data source does not provide resources.");
      return options.source.resourceUrl(snapshot.project.id, path);
    },
    requestInlineAi(request) {
      inlineAiRequest = request;
    },
    sidebar: sidebar.actions,
    async addProject(path) {
      if (
        disposed ||
        !options.source.addProject ||
        sidebar.state.projectOpening
      )
        return;
      const request = new AbortController();
      pending.add(request);
      sidebar.update({ projectOpening: true, projectError: "" });
      const version = ++generation;
      try {
        const next = await options.source.addProject(path, request.signal);
        if (
          disposed ||
          request.signal.aborted ||
          version !== generation ||
          !next
        )
          return;
        projects = [
          ...projects.filter((p) => p.id !== next.project.id),
          next.project,
        ];
        if (snapshot)
          reviewCache.set(snapshot.project.id, get(workspace.reviewLedger));
        workspace.reviewLedger.set(null);
        activeFile = next.project.entryFile;
        apply(next);
        remember(currentEntry(parseRoute("/dashboard")));
        sidebar.update({
          mode: "workspace",
          projectFormOpen: false,
          projectPath: "",
        });
      } catch (cause) {
        if (!disposed && !request.signal.aborted)
          sidebar.update({
            projectError:
              cause instanceof Error ? cause.message : String(cause),
          });
      } finally {
        pending.delete(request);
        if (!disposed) sidebar.update({ projectOpening: false });
      }
    },
    openSettings(path = "/import/accounts") {
      sidebar.actions.setMode("workspace");
      actions.navigate(path);
    },
    returnFromSettings() {
      const target = settingsReturn;
      settingsReturn = undefined;
      if (target?.projectId) {
        const next = projectCache.get(target.projectId);
        if (next) {
          workspace.reviewLedger.set(
            reviewCache.get(target.projectId) ?? get(workspace.reviewLedger),
          );
          activeFile = target.file;
          apply(next);
        }
      }
      remember(target ?? currentEntry(parseRoute("/dashboard")));
    },
    selectTags(tags) {
      const params = new URLSearchParams(history[index]!.route.query);
      const search = parseLedgerSearchState(params);
      search.tags = tags.map(normalizeLedgerTag).filter(Boolean);
      appendLedgerSearchParams(params, search);
      actions.navigate(`?${params}`);
    },
    navigate(path, options) {
      if (disposed) return;
      const next = parseRoute(
        path.startsWith("?") ? history[index]!.route.path + path : path,
      );
      const file = next.query.ledger;
      if (file && snapshot?.ledgerFiles.some((item) => item.path === file)) {
        activeFile = file;
        apply(snapshot);
      }
      const entry = currentEntry(next);
      if (options?.replace) {
        if (JSON.stringify(entry) === JSON.stringify(history[index])) return;
        history = history.map((previous, i) =>
          i === index ? entry : previous,
        );
        syncRoute();
      } else remember(entry);
    },
    back() {
      restore(index - 1);
    },
    forward() {
      restore(index + 1);
    },
    selectProject,
    selectFile(path, route) {
      if (
        disposed ||
        !snapshot ||
        (!snapshot.ledgerFiles.some((file) => file.path === path) &&
          get(workspace.reviewLedger)?.path !== path)
      )
        return;
      activeFile = path;
      apply(snapshot);
      sidebar.actions.setExpanded("files", path, true);
      remember(currentEntry(route ? parseRoute(route) : undefined));
    },
    setQuery(query) {
      actions.navigate(
        `?${new URLSearchParams({ ...history[index]!.route.query, query })}`,
      );
    },
    setConversion(value) {
      presentation.conversion.set(value);
    },
    async saveFile(path, contents, expectedRevision) {
      if (!snapshot) throw new Error("No project selected.");
      const project = snapshot.project.id;
      await operate(
        (signal) =>
          options.source.saveFile(
            project,
            path,
            contents,
            expectedRevision,
            signal,
          ),
        (next) => {
          if (snapshot?.project.id === project) apply(next);
        },
      );
    },
    async refresh() {
      if (snapshot) await loadProject(snapshot.project.id, false, false);
    },
    async retry() {
      if (snapshot) await actions.refresh();
      else {
        initialized = undefined;
        await initialize();
      }
    },
  };
  function initialize(): Promise<void> {
    if (disposed)
      return Promise.reject(new Error("Controller has been disposed."));
    return (initialized ??= operate(
      (signal) => options.source.listProjects(signal),
      (next) => {
        projects = next;
      },
    ).then(async () => {
      if (disposed) return;
      if (projects[0]) await loadProject(projects[0].id, false);
      else status = "empty";
    }));
  }
  const services = {
    sync: createIngestionSync(actions.request),
    syncStatus: undefined as unknown as ReturnType<typeof createSyncStatus>,
  };
  services.syncStatus = createSyncStatus(services.sync);
  const workspace = createStudioWorkspace(
    actions.saveFile,
    async () => {
      await actions.refresh();
      if (!snapshot) throw new Error("No project selected.");
      return snapshot;
    },
    async () => {
      if (!snapshot || !options.source.request) return null;
      const response = await actions.request(
        ingestionPath(snapshot.project.id, "/review-ledger"),
      );
      if (!response.ok) throw new Error("Review ledger is unavailable.");
      const next = await response.json();
      workspace.reviewLedger.set(next);
      return next;
    },
    actions.resourceUrl,
    actions.requestInlineAi,
  );
  const navigation = createControllerNavigation(routeStore, actions);
  const unsubscribeFile = workspace.activeFile.subscribe((path) => {
    if (path && path !== activeFile) actions.selectFile(path);
  });
  const unsubscribeSnapshot = workspace.snapshot.subscribe((next) => {
    if (next && next !== snapshot) apply(next);
  });
  syncRoute();
  const unsubscribeSidebarMode = workspace.ledgerSidebarMode.subscribe(
    (mode) => {
      if (mode === "settings" && !isSettingsRoute(history[index]!.route.path))
        actions.openSettings();
      else if (
        mode === "workspace" &&
        isSettingsRoute(history[index]!.route.path)
      )
        actions.returnFromSettings();
    },
  );
  return {
    services,
    workspace,
    navigation,
    state: {
      get inlineAiRequest() {
        return inlineAiRequest;
      },
      get sidebar() {
        return sidebar.state;
      },
      get canAddProject() {
        return Boolean(options.source.addProject);
      },
      get route() {
        return history[index]!.route;
      },
      get projects() {
        return projects;
      },
      get snapshot() {
        return snapshot;
      },
      get activeFile() {
        return activeFile;
      },
      get ledger() {
        return ledger;
      },
      get status() {
        return status;
      },
      get error() {
        return error;
      },
      get canNavigateBack() {
        return index > 0;
      },
      get canNavigateForward() {
        return index < history.length - 1;
      },
    },
    actions,
    presentation,
    clock: options.clock ?? (() => DateTime.now()),
    initialize,
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      generation++;
      for (const request of pending) request.abort();
      pending.clear();
      unsubscribe();
      unsubscribeFile();
      unsubscribeSnapshot();
      unsubscribeSidebarMode();
      services.syncStatus.dispose();
    },
  };
}
