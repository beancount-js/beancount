<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import Main from "../../../../Main.svelte";
  import { getWebWorkspace } from "$lib/web-workspace";
  import { projectHref } from "$lib/project-path";
  import {
    buildLedgerHref,
    DEFAULT_LEDGER_VIEW,
    ledgerStemForPath,
    parseLedgerAndView,
    resolveLedgerPath,
  } from "$lib/ledger-route";
  import { setStudioRouteEnv } from "$lib/studio-route-env";
  import type {
    ProjectSnapshot,
    ProjectSummary,
  } from "@beancount-js/workspace";
  import type { IngestionReviewLedgerSnapshot } from "../../../../ingestion/types";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  let webWorkspace = isWeb ? getWebWorkspace() : undefined;
  let projects: ProjectSummary[] = [];
  let snapshot: ProjectSnapshot | undefined;
  let status = "Loading project…";
  let loadedProjectId = "";
  let routeLedgerPath: string | undefined;
  let reviewLedger: IngestionReviewLedgerSnapshot | null = null;

  $: projectId = $page.params.projectId ?? "";
  $: ledgerAndView = ($page.params.ledgerAndView ?? "")
    .split("/")
    .filter(Boolean);

  async function responseJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        (body as { error?: string }).error ?? response.statusText,
      );
    return body as T;
  }

  async function refreshProjects() {
    projects =
      isWeb && webWorkspace
        ? await webWorkspace.listProjects()
        : await responseJson<ProjectSummary[]>(await fetch("/api/projects"));
  }

  async function navigateToProject(id: string) {
    if (!browser || id === projectId) return;
    await goto(projectHref(id), { keepFocus: true, noScroll: true });
  }

  function availableLedgers(next: ProjectSnapshot, review = reviewLedger) {
    return [
      ...next.ledgerFiles.map((file) => file.path),
      ...(review ? [review.path] : []),
    ];
  }

  async function loadReviewLedger(id: string) {
    if (isWeb) return null;
    const response = await responseJson<{
      ledger: IngestionReviewLedgerSnapshot | null;
    }>(
      await fetch(
        `/api/projects/${encodeURIComponent(id)}/ingestion/review-ledger`,
      ),
    );
    return response.ledger;
  }

  function syncLedgerFromRoute(
    next: ProjectSnapshot,
    segments: string[],
    review = reviewLedger,
  ) {
    const available = availableLedgers(next, review);
    const parsed = parseLedgerAndView(segments);
    const fallback = next.project.entryFile;
    let ledgerPath = fallback;
    if (parsed) {
      const resolved =
        resolveLedgerPath(parsed.ledgerStem, available) ??
        (available.includes(parsed.ledgerStem) ? parsed.ledgerStem : null);
      if (resolved) ledgerPath = resolved;
      else status = `Ledger not found: ${parsed.ledgerStem}`;
    }
    routeLedgerPath = ledgerPath;
    setStudioRouteEnv({
      projectId: next.project.id,
      ledgerPath,
      ledgerStem: ledgerStemForPath(ledgerPath, available),
      availableLedgers: available,
    });
    return { ledgerPath, parsed, available };
  }

  async function loadProject(id: string) {
    snapshot =
      isWeb && webWorkspace
        ? await webWorkspace.readProject(id)
        : await responseJson<ProjectSnapshot>(
            await fetch(`/api/projects/${encodeURIComponent(id)}`),
          );
    reviewLedger = await loadReviewLedger(id);
    loadedProjectId = id;
    status = `${snapshot.ledgerFiles.length} Beancount sources · ${snapshot.resources.length} resources`;
    const { ledgerPath, parsed, available } = syncLedgerFromRoute(
      snapshot,
      ledgerAndView,
    );
    if (!parsed || !segmentsHaveView(ledgerAndView)) {
      const stem = ledgerStemForPath(ledgerPath, available);
      await goto(
        buildLedgerHref(id, stem, parsed?.viewPath ?? DEFAULT_LEDGER_VIEW),
        { replaceState: true },
      );
    }
  }

  function segmentsHaveView(segments: string[]) {
    const parsed = parseLedgerAndView(segments);
    if (!parsed) return false;
    // Stem-only URLs default to dashboard — redirect so the URL includes /dashboard
    const last = segments.at(-1);
    const hasHistoryRun =
      segments.length >= 3 &&
      segments.at(-3) === "settings" &&
      segments.at(-2) === "history" &&
      Boolean(last);
    return Boolean(
      hasHistoryRun ||
        (last &&
          (last === "accounts" ||
            last === "merchants" ||
            last === "manage-merchants" ||
            last === "brands" ||
            last === "history" ||
            last === "rules" ||
            segments.includes("account") ||
            [
              "journal",
              "dashboard",
              "editor",
              "income-statement",
              "balance-sheet",
              "trial-balance",
              "holdings",
              "statistics",
              "query",
              "errors",
              "records",
              "resource",
              "directives",
              "settings",
            ].includes(last))),
    );
  }

  async function selectProject(id: string) {
    if (id !== projectId) {
      await navigateToProject(id);
      return;
    }
    await loadProject(id);
  }

  async function addProject(path?: string) {
    try {
      if (isWeb) {
        if (!webWorkspace || !browser || !("showDirectoryPicker" in window)) {
          throw new Error(
            "This browser does not support opening local folders.",
          );
        }
        const handle = await (
          window as Window & {
            showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker();
        const project = await webWorkspace!.addDirectory(handle);
        await refreshProjects();
        await navigateToProject(project.id);
      } else {
        if (!path)
          throw new Error("Enter the path to a Beancount project folder.");
        const project = await responseJson<{ id: string }>(
          await fetch("/api/projects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ root: path }),
          }),
        );
        await refreshProjects();
        await navigateToProject(project.id);
      }
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  async function saveFile(
    path: string,
    contents: string,
    expectedRevision?: string,
  ) {
    if (!snapshot) throw new Error("No project is selected.");
    if (isWeb && webWorkspace) {
      await webWorkspace.writeFile(
        snapshot.project.id,
        { path, contents },
        expectedRevision ? { expectedRevision } : undefined,
      );
      const next = await webWorkspace.readProject(snapshot.project.id);
      snapshot = next;
      await refreshProjects();
      return next;
    }
    await responseJson(
      await fetch(
        `/api/projects/${encodeURIComponent(snapshot.project.id)}/files/${path.split("/").map(encodeURIComponent).join("/")}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents, expectedRevision }),
        },
      ),
    );
    const next = await responseJson<ProjectSnapshot>(
      await fetch(`/api/projects/${encodeURIComponent(snapshot.project.id)}`),
    );
    snapshot = next;
    await refreshProjects();
    return next;
  }

  async function refreshProject(): Promise<ProjectSnapshot> {
    if (!snapshot) throw new Error("No project is selected.");
    await loadProject(snapshot.project.id);
    await refreshProjects();
    if (!snapshot) throw new Error("No project is selected.");
    return snapshot;
  }

  async function refreshReviewLedger() {
    if (!snapshot) throw new Error("No project is selected.");
    reviewLedger = await loadReviewLedger(snapshot.project.id);
    return reviewLedger;
  }

  async function resourceUrl(path: string) {
    if (!snapshot) throw new Error("No project is selected.");
    const resource = snapshot.resources.find((item) => item.path === path);
    if (!resource) throw new Error("Resource is not available.");
    if (isWeb && webWorkspace) {
      const bytes = await webWorkspace.readResource(snapshot.project.id, path);
      const body = new Uint8Array(bytes.byteLength);
      body.set(bytes);
      const url = URL.createObjectURL(
        new Blob([body.buffer], { type: resource.mimeType }),
      );
      return {
        url,
        mimeType: resource.mimeType,
        revoke: () => URL.revokeObjectURL(url),
      };
    }
    return {
      url: `/api/projects/${encodeURIComponent(snapshot.project.id)}/resources/${path.split("/").map(encodeURIComponent).join("/")}`,
      mimeType: resource.mimeType,
    };
  }

  $: if (browser && projectId && projectId !== loadedProjectId) {
    void (async () => {
      const id = projectId;
      try {
        if (isWeb) {
          webWorkspace = getWebWorkspace();
          const listed = await webWorkspace.listProjects();
          if (!listed.length) await webWorkspace.addOpfsProject();
          const nextListed = await webWorkspace.listProjects();
          if (
            nextListed.length &&
            !nextListed.some((project) => project.id === id)
          ) {
            await goto(projectHref(nextListed[0]!.id), { replaceState: true });
            return;
          }
        }
        await refreshProjects();
        await loadProject(id);
      } catch (error) {
        if (id !== projectId) return;
        snapshot = undefined;
        loadedProjectId = "";
        status = error instanceof Error ? error.message : String(error);
      }
    })();
  }

  $: if (browser && snapshot && loadedProjectId === projectId) {
    syncLedgerFromRoute(snapshot, ledgerAndView);
  }

  onMount(() => {
    const timer = window.setInterval(async () => {
      if (isWeb || !snapshot) return;
      try {
        const [next, nextReviewLedger] = await Promise.all([
          responseJson<ProjectSnapshot>(
            await fetch(
              `/api/projects/${encodeURIComponent(snapshot.project.id)}`,
            ),
          ),
          loadReviewLedger(snapshot.project.id),
        ]);
        if (
          JSON.stringify(next.revisions) !== JSON.stringify(snapshot.revisions)
        ) {
          snapshot = next;
          status = "Reloaded external filesystem changes";
        }
        if (nextReviewLedger?.revision !== reviewLedger?.revision) {
          reviewLedger = nextReviewLedger;
        }
      } catch {
        // A later poll reconciles a restarting local server.
      }
    }, 4_000);
    return () => window.clearInterval(timer);
  });
</script>

<Main
  {snapshot}
  {projects}
  {isWeb}
  {status}
  {routeLedgerPath}
  {reviewLedger}
  onSelectProject={selectProject}
  onAddProject={addProject}
  onSaveFile={saveFile}
  onRefreshProject={refreshProject}
  onRefreshReviewLedger={refreshReviewLedger}
  onResourceUrl={resourceUrl}
/>
