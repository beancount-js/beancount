<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import Main from "../../Main.svelte";
  import { getWebWorkspace } from "$lib/web-workspace";
  import { projectHref } from "$lib/project-path";
  import {
    buildLedgerHref,
    ledgerStemForPath,
  } from "$lib/ledger-route";
  import type {
    ProjectSnapshot,
    ProjectSummary,
  } from "@beancount-js/workspace";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  let webWorkspace = isWeb ? getWebWorkspace() : undefined;
  let projects: ProjectSummary[] = [];
  let snapshot: ProjectSnapshot | undefined;
  let status = "Opening ledger…";
  let loadedProjectId = "";

  $: projectId = $page.params.projectId ?? "";

  async function responseJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        (body as { error?: string }).error ?? response.statusText,
      );
    return body as T;
  }

  async function loadAndRedirect(id: string) {
    if (isWeb) {
      webWorkspace = getWebWorkspace();
      let listed = await webWorkspace.listProjects();
      if (!listed.length) {
        await webWorkspace.addOpfsProject();
        listed = await webWorkspace.listProjects();
      }
      if (listed.length && !listed.some((project) => project.id === id)) {
        await goto(projectHref(listed[0]!.id), { replaceState: true });
        return;
      }
      snapshot = await webWorkspace.readProject(id);
    } else {
      snapshot = await responseJson<ProjectSnapshot>(
        await fetch(`/api/projects/${encodeURIComponent(id)}`),
      );
    }
    loadedProjectId = id;
    projects = isWeb
      ? await webWorkspace!.listProjects()
      : await responseJson<ProjectSummary[]>(await fetch("/api/projects"));
    const available = snapshot.ledgerFiles.map((file) => file.path);
    const entry = snapshot.project.entryFile;
    const stem = ledgerStemForPath(entry, available);
    await goto(buildLedgerHref(id, stem, "/journal"), { replaceState: true });
  }

  $: if (browser && projectId && projectId !== loadedProjectId) {
    void loadAndRedirect(projectId).catch((error) => {
      status = error instanceof Error ? error.message : String(error);
    });
  }
</script>

<Main
  {snapshot}
  {projects}
  {isWeb}
  {status}
  onSelectProject={async () => undefined}
  onAddProject={async () => undefined}
  onSaveFile={async () => {
    throw new Error("No ledger is open.");
  }}
  onRefreshProject={async () => undefined}
  onResourceUrl={async () => {
    throw new Error("No ledger is open.");
  }}
/>
