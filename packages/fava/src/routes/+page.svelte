<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import Main from "../Main.svelte";
  import { BrowserWorkspaceAdapter } from "@beancount-js/web";
  import type { ProjectSnapshot, ProjectSummary } from "@beancount-js/workspace";
  import type { InlineAiRequest } from "../studio/workspace";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  let webWorkspace: BrowserWorkspaceAdapter | undefined;
  let projects: ProjectSummary[] = [];
  let snapshot: ProjectSnapshot | undefined;
  let status = "Loading projects…";

  async function responseJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((body as { error?: string }).error ?? response.statusText);
    return body as T;
  }

  async function refreshProjects() {
    projects = isWeb && webWorkspace
      ? await webWorkspace.listProjects()
      : await responseJson<ProjectSummary[]>(await fetch("/api/projects"));
  }

  async function selectProject(id: string) {
    snapshot = isWeb && webWorkspace
      ? await webWorkspace.readProject(id)
      : await responseJson<ProjectSnapshot>(await fetch(`/api/projects/${encodeURIComponent(id)}`));
    status = `${snapshot.ledgerFiles.length} Beancount sources · ${snapshot.resources.length} resources`;
  }

  async function addProject(path?: string) {
    try {
      if (isWeb) {
        if (!webWorkspace || !browser || !("showDirectoryPicker" in window)) {
          throw new Error("This browser does not support opening local folders.");
        }
        const handle = await (window as Window & { showDirectoryPicker(): Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
        const project = await webWorkspace.addDirectory(handle);
        await refreshProjects();
        await selectProject(project.id);
      } else {
        if (!path) throw new Error("Enter the path to a Beancount project folder.");
        const project = await responseJson<{ id: string }>(
          await fetch("/api/projects", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ root: path }),
          }),
        );
        await refreshProjects();
        await selectProject(project.id);
      }
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
    }
  }

  async function saveFile(path: string, contents: string) {
    if (!snapshot) throw new Error("No project is selected.");
    if (isWeb && webWorkspace) {
      await webWorkspace.writeFile(snapshot.project.id, { path, contents });
      const next = await webWorkspace.readProject(snapshot.project.id);
      snapshot = next;
      await refreshProjects();
      return next;
    }
    await responseJson(
      await fetch(`/api/projects/${encodeURIComponent(snapshot.project.id)}/files/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents }),
      }),
    );
    const next = await responseJson<ProjectSnapshot>(
      await fetch(`/api/projects/${encodeURIComponent(snapshot.project.id)}`),
    );
    snapshot = next;
    await refreshProjects();
    return next;
  }

  async function askAi(question: string, context?: InlineAiRequest) {
    if (isWeb) return "AI is available when this project is opened through the local Beancount Studio server.";
    if (!snapshot) throw new Error("No project is selected.");
    const result = await responseJson<{ answer: string }>(
      await fetch(`/api/projects/${encodeURIComponent(snapshot.project.id)}/ai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, context }),
      }),
    );
    return result.answer;
  }

  async function resourceUrl(path: string) {
    if (!snapshot) throw new Error("No project is selected.");
    const resource = snapshot.resources.find((item) => item.path === path);
    if (!resource) throw new Error("Resource is not available.");
    if (isWeb && webWorkspace) {
      const bytes = await webWorkspace.readResource(snapshot.project.id, path);
      const body = new Uint8Array(bytes.byteLength);
      body.set(bytes);
      const url = URL.createObjectURL(new Blob([body.buffer], { type: resource.mimeType }));
      return { url, mimeType: resource.mimeType, revoke: () => URL.revokeObjectURL(url) };
    }
    return {
      url: `/api/projects/${encodeURIComponent(snapshot.project.id)}/resources/${path.split("/").map(encodeURIComponent).join("/")}`,
      mimeType: resource.mimeType,
    };
  }

  onMount(() => {
    void (async () => {
      try {
        if (isWeb) {
          webWorkspace = new BrowserWorkspaceAdapter();
          const project = await webWorkspace.addOpfsProject();
          await refreshProjects();
          await selectProject(project.id);
        } else {
          await refreshProjects();
          if (projects[0]) await selectProject(projects[0].id);
          else status = "Add a local Beancount project to begin.";
        }
      } catch (error) {
        status = error instanceof Error ? error.message : String(error);
      }
    })();

    const timer = window.setInterval(async () => {
      if (isWeb || !snapshot) return;
      try {
        const next = await responseJson<ProjectSnapshot>(
          await fetch(`/api/projects/${encodeURIComponent(snapshot.project.id)}`),
        );
        if (JSON.stringify(next.revisions) !== JSON.stringify(snapshot.revisions)) {
          snapshot = next;
          status = "Reloaded external filesystem changes";
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
  onSelectProject={selectProject}
  onAddProject={addProject}
  onSaveFile={saveFile}
  onAskAi={askAi}
  onResourceUrl={resourceUrl}
/>
