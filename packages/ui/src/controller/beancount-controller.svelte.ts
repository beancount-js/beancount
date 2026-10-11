import { createStudioWorkspace } from "../domain/studio/workspace";
import { createControllerNavigation } from "../domain/router/router";
import { get, writable } from "svelte/store";
import { DateTime } from "luxon";
import { createContext } from "../domain/context";
import { LedgerSource } from "../domain/core/ledger";
import { MainNav } from "../domain/menu";
import { parseRoute } from "./routes";
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
  let history = $state.raw([initialRoute]);
  let index = $state(0);
  const routeStore = writable(initialRoute);
  let inlineAiRequest =
    $state.raw<import("../domain/studio/workspace").InlineAiRequest>();
  function syncRoute() {
    routeStore.set(history[index]!);
    presentation.query.set(history[index]!.query.query ?? "");
  }
  let disposed = false;
  let initialized: Promise<void> | undefined;
  let generation = 0;
  const pending = new Set<AbortController>();
  const unsubscribe = presentation.ledgerData.subscribe((value) => {
    ledger = value;
  });
  function apply(next: ProjectSnapshot) {
    snapshot = next;
    if (!next.ledgerFiles.some((file) => file.path === activeFile))
      activeFile = next.project.entryFile;
    presentation.ledgerSource.set(
      LedgerSource.fromProject(activeFile, next.ledgerFiles),
    );
    workspace.snapshot.set(next);
    workspace.activeFile.set(activeFile);
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
  async function selectProject(id: string) {
    const version = ++generation;
    await operate(
      (signal) => options.source.loadProject(id, signal),
      (next) => {
        if (version === generation) {
          activeFile = next.project.entryFile;
          apply(next);
        }
      },
    );
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
          signal: init.signal
            ? AbortSignal.any([init.signal, request.signal])
            : request.signal,
        });
      } finally {
        pending.delete(request);
      }
    },
    async resourceUrl(path) {
      if (!snapshot || !options.source.resourceUrl)
        throw new Error("This data source does not provide resources.");
      return options.source.resourceUrl(snapshot.project.id, path);
    },
    requestInlineAi(request) {
      inlineAiRequest = request;
    },
    navigate(path) {
      if (disposed) return;
      const next = parseRoute(
        path.startsWith("?") ? history[index]!.path + path : path,
      );
      if (JSON.stringify(next) === JSON.stringify(history[index])) return;
      history = [...history.slice(0, index + 1), next];
      index++;
      syncRoute();
    },
    back() {
      if (!disposed) {
        index = Math.max(0, index - 1);
        syncRoute();
      }
    },
    forward() {
      if (!disposed) {
        index = Math.min(history.length - 1, index + 1);
        syncRoute();
      }
    },
    selectProject,
    selectFile(path) {
      if (disposed || !snapshot?.ledgerFiles.some((file) => file.path === path))
        return;
      activeFile = path;
      apply(snapshot);
    },
    setQuery(query) {
      presentation.query.set(query);
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
      if (snapshot) await selectProject(snapshot.project.id);
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
      if (projects[0]) await selectProject(projects[0].id);
      else status = "empty";
    }));
  }
  const workspace = createStudioWorkspace(
    actions.saveFile,
    async () => {
      await actions.refresh();
      if (!snapshot) throw new Error("No project selected.");
      return snapshot;
    },
    async () => null,
    actions.resourceUrl,
    actions.requestInlineAi,
  );
  const navigation = createControllerNavigation(routeStore, actions);
  const unsubscribeFile = workspace.activeFile.subscribe((path) => {
    if (path && path !== activeFile) actions.selectFile(path);
  });
  syncRoute();
  return {
    workspace,
    navigation,
    state: {
      get inlineAiRequest() {
        return inlineAiRequest;
      },
      get route() {
        return history[index]!;
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
      generation++;
      for (const request of pending) request.abort();
      pending.clear();
      unsubscribe();
      unsubscribeFile();
    },
  };
}
