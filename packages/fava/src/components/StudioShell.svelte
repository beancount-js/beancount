<script lang="ts">
  import FolderOpen from "lucide-svelte/icons/folder-open";
  import LayoutPanelLeft from "lucide-svelte/icons/layout-panel-left";
  import Plus from "lucide-svelte/icons/plus";
  import type { ProjectSnapshot, ProjectSummary } from "@beancount-js/workspace";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Button } from "$lib/components/ui/button";
  import { Separator } from "$lib/components/ui/separator";
  import { StructuredForm, createFormConfig, textField } from "@beancount-js/forms";

  export let projects: ProjectSummary[] = [];
  export let snapshot: ProjectSnapshot | undefined;
  export let isWeb = false;
  export let status = "";
  export let onSelectProject: (id: string) => void | Promise<void>;
  export let onAddProject: (path?: string) => void | Promise<void>;

  let tab: "projects" | "workspace" = "workspace";
  let enteringPath = false;
  let path = "";
  const projectPathForm = createFormConfig<{ path: string }>({
    id: "add-project-path",
    fields: [
      textField({
        id: "path",
        label: "Project folder",
        placeholder: "/path/to/ledger",
        get: (value) => value.path,
        set: (value, next) => ({ ...value, path: next }),
      }),
    ],
  });

  async function addProject() {
    if (isWeb) {
      await onAddProject();
      return;
    }
    enteringPath = true;
  }

  async function submitPath() {
    if (!path.trim()) return;
    await onAddProject(path.trim());
    path = "";
    enteringPath = false;
  }
</script>

<Sidebar.Provider class="h-svh overflow-hidden bg-sidebar text-foreground">
  <Sidebar.Root collapsible="icon" variant="inset">
    <Sidebar.Header class="gap-2">
      <div class="flex items-center gap-2">
        <div class="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground">B</div>
        <div class="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p class="truncate text-sm font-semibold">Beancount Studio</p><p class="truncate text-xs text-muted-foreground">{snapshot?.project.name ?? "No project"}</p></div>
      </div>
      <div class="grid grid-cols-2 gap-1 rounded-md border border-sidebar-border bg-sidebar-accent/50 p-1 group-data-[collapsible=icon]:grid-cols-1">
        <Button variant={tab === "projects" ? "secondary" : "ghost"} size="icon" aria-label="Projects" title="Projects" onclick={() => (tab = "projects")}><FolderOpen /></Button>
        <Button variant={tab === "workspace" ? "secondary" : "ghost"} size="icon" aria-label="Workspace" title="Workspace" onclick={() => (tab = "workspace")}><LayoutPanelLeft /></Button>
      </div>
    </Sidebar.Header>
    <Sidebar.Content>
      {#if tab === "projects"}
        <Sidebar.Group>
          <Sidebar.GroupLabel>Projects</Sidebar.GroupLabel>
          <Sidebar.GroupContent class="flex flex-col gap-1">
            {#each projects as project (project.id)}
              <Button
                variant={snapshot?.project.id === project.id ? "secondary" : "ghost"}
                size="sm"
                class="h-auto w-full justify-start py-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
                title={project.name}
                onclick={() => void onSelectProject(project.id)}
              >
                <FolderOpen data-icon="inline-start" />
                <span class="min-w-0 text-left group-data-[collapsible=icon]:hidden"><span class="block truncate">{project.name}</span><span class="block truncate text-xs text-muted-foreground">{project.entryFile}</span></span>
              </Button>
            {/each}
          </Sidebar.GroupContent>
        </Sidebar.Group>
        <Separator class="my-2" />
        <div class="px-2">
          {#if enteringPath}
            <form class="flex flex-col gap-2" on:submit|preventDefault={submitPath}>
              <StructuredForm config={projectPathForm} value={{ path }} context={undefined} onChange={(value) => (path = value.path)} />
              <div class="flex gap-2"><Button type="submit" size="sm" class="flex-1">Add</Button><Button type="button" variant="ghost" size="sm" onclick={() => (enteringPath = false)}>Cancel</Button></div>
            </form>
          {:else}
            <Button variant="outline" size="sm" class="w-full justify-start group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0" onclick={() => void addProject()}>
              <Plus data-icon="inline-start" /><span class="group-data-[collapsible=icon]:hidden">Add project</span>
            </Button>
          {/if}
        </div>
      {:else}
        <slot name="workspace"></slot>
      {/if}
    </Sidebar.Content>
    <Sidebar.Footer class="group-data-[collapsible=icon]:hidden"><p class="truncate text-xs text-muted-foreground">{status}</p></Sidebar.Footer>
    <Sidebar.Rail />
  </Sidebar.Root>
  <Sidebar.Inset class="min-w-0 bg-sidebar p-2">
    <main class="h-full min-w-0 overflow-hidden rounded-xl border bg-background shadow-sm"><slot></slot></main>
  </Sidebar.Inset>
</Sidebar.Provider>
