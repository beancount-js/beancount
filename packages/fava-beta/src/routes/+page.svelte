<script lang="ts">
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import Main from "../Main.svelte";
  import { getWebWorkspace } from "$lib/web-workspace";
  import { projectHref } from "$lib/project-path";
  import type { ProjectSummary } from "@beancount-js/workspace";

  const isWeb = import.meta.env.VITE_BEANCOUNT_STUDIO_RUNTIME === "web";
  let projects: ProjectSummary[] = [];
  let status = isWeb
    ? "Opening browser workspace…"
    : "Add a local Beancount project to begin.";

  async function responseJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        (body as { error?: string }).error ?? response.statusText,
      );
    return body as T;
  }

  async function addProject(path?: string) {
    try {
      if (isWeb) {
        const webWorkspace = getWebWorkspace();
        if (!browser || !("showDirectoryPicker" in window)) {
          throw new Error(
            "This browser does not support opening local folders.",
          );
        }
        const handle = await (
          window as Window & {
            showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
          }
        ).showDirectoryPicker();
        const project = await webWorkspace.addDirectory(handle);
        await goto(projectHref(project.id));
        return;
      }
      if (!path)
        throw new Error("Enter the path to a Beancount project folder.");
      const project = await responseJson<{ id: string }>(
        await fetch("/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ root: path }),
        }),
      );
      await goto(projectHref(project.id));
    } catch (error) {
      status = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  onMount(() => {
    void (async () => {
      try {
        if (isWeb) {
          const webWorkspace = getWebWorkspace();
          let listed = await webWorkspace.listProjects();
          if (!listed.length) {
            await webWorkspace.addOpfsProject();
            listed = await webWorkspace.listProjects();
          }
          const id = listed[0]?.id;
          if (id) {
            await goto(projectHref(id), { replaceState: true });
            return;
          }
        } else {
          projects = await responseJson<ProjectSummary[]>(
            await fetch("/api/projects"),
          );
          const id = projects[0]?.id;
          if (id) {
            await goto(projectHref(id), { replaceState: true });
            return;
          }
          status = "Add a local Beancount project to begin.";
        }
      } catch (error) {
        status = error instanceof Error ? error.message : String(error);
      }
    })();
  });
</script>

<Main
  snapshot={undefined}
  {projects}
  {isWeb}
  {status}
  onSelectProject={async () => undefined}
  onAddProject={addProject}
  onSaveFile={async () => {
    throw new Error("No project is selected.");
  }}
  onRefreshProject={async () => {
    throw new Error("No project is selected.");
  }}
  onResourceUrl={async () => {
    throw new Error("No project is selected.");
  }}
/>
