import { get } from "svelte/store";
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
  let history = $state.raw([parseRoute(options.initialRoute ?? "/dashboard")]);
  let index = $state(0);
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
    navigate(path) {
      if (disposed) return;
      const next = parseRoute(path);
      if (JSON.stringify(next) === JSON.stringify(history[index])) return;
      history = [...history.slice(0, index + 1), next];
      index++;
    },
    back() {
      if (!disposed) index = Math.max(0, index - 1);
    },
    forward() {
      if (!disposed) index = Math.min(history.length - 1, index + 1);
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
  return {
    state: {
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
    },
  };
}
