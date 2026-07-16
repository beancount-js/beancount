<script lang="ts">
  import { onDestroy } from "svelte";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import FolderOpen from "lucide-svelte/icons/folder-open";
  import LayoutPanelLeft from "lucide-svelte/icons/layout-panel-left";
  import Moon from "lucide-svelte/icons/moon";
  import Plus from "lucide-svelte/icons/plus";
  import SearchIcon from "lucide-svelte/icons/search";
  import Sun from "lucide-svelte/icons/sun";
  import { toggleMode } from "mode-watcher";
  import type {
    ProjectSnapshot,
    ProjectSummary,
  } from "@beancount-js/workspace";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Button } from "$lib/components/ui/button";
  import * as Empty from "$lib/components/ui/empty";
  import { Separator } from "$lib/components/ui/separator";
  import { cn } from "$lib/utils";
  import {
    StructuredForm,
    createFormConfig,
    textField,
  } from "@beancount-js/forms";
  import StudioShellHeader from "./StudioShellHeader.svelte";
  import IngestionHeaderActions from "./IngestionHeaderActions.svelte";
  import { activeSyncTracks } from "../studio/sync-status";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";

  export let projects: ProjectSummary[] = [];
  export let snapshot: ProjectSnapshot | undefined;
  export let isWeb = false;
  export let status = "";
  export let pageTitle = "Beancount Studio";
  export let onSelectProject: (id: string) => void | Promise<void>;
  export let onAddProject: (path?: string) => void | Promise<void>;

  type SidebarTab = "projects" | "workspace" | "search";

  const SIDEBAR_WIDTH_STORAGE_KEY = "beancount-studio:sidebar-width";
  const SIDEBAR_TAB_STORAGE_KEY = "beancount-studio:sidebar-tab";
  const DEFAULT_SIDEBAR_WIDTH = 256;
  const MIN_SIDEBAR_WIDTH = 220;
  const MAX_SIDEBAR_WIDTH = 520;

  let tab: SidebarTab = readStoredSidebarTab();
  let enteringPath = false;
  let addingProject = false;
  let path = "";
  let projectActionError: string | null = null;
  let sidebarWidth = readStoredSidebarWidth();
  let resizing = false;
  let hoveringResizer = false;
  let resizeStartX = 0;
  let resizeStartWidth = DEFAULT_SIDEBAR_WIDTH;
  let previousBodyCursor = "";
  let previousBodyUserSelect = "";

  $: sidebarWidthStyle = `--sidebar-width: ${sidebarWidth}px;`;
  $: if (typeof localStorage !== "undefined") {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
    localStorage.setItem(SIDEBAR_TAB_STORAGE_KEY, tab);
  }
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
    if (addingProject) return;
    addingProject = true;
    projectActionError = null;
    try {
      if (isWeb) {
        await onAddProject();
        return;
      }
      const response = await fetch("/api/projects/pick-directory", {
        method: "POST",
      });
      const picked = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        path?: string;
        error?: string;
      };
      if (picked.ok && picked.path) {
        await onAddProject(picked.path);
        enteringPath = false;
        path = "";
        return;
      }
      if (!picked.ok && picked.error === "No directory was selected.") {
        return;
      }
      enteringPath = true;
      projectActionError =
        picked.error ??
        (response.ok
          ? null
          : response.statusText || "Could not open folder picker.");
    } catch (error) {
      enteringPath = true;
      projectActionError =
        error instanceof Error ? error.message : String(error);
    } finally {
      addingProject = false;
    }
  }

  async function openProject() {
    tab = "projects";
    await addProject();
  }

  async function submitPath() {
    if (!path.trim() || addingProject) return;
    addingProject = true;
    projectActionError = null;
    try {
      await onAddProject(path.trim());
      path = "";
      enteringPath = false;
    } catch (error) {
      projectActionError =
        error instanceof Error ? error.message : String(error);
    } finally {
      addingProject = false;
    }
  }

  function cancelPathEntry() {
    enteringPath = false;
    path = "";
    projectActionError = null;
  }

  function readStoredSidebarTab(): SidebarTab {
    if (typeof localStorage === "undefined") return "workspace";
    const stored = localStorage.getItem(SIDEBAR_TAB_STORAGE_KEY);
    if (
      stored === "projects" ||
      stored === "workspace" ||
      stored === "search"
    ) {
      return stored;
    }
    return "workspace";
  }

  function readStoredSidebarWidth() {
    if (typeof localStorage === "undefined") return DEFAULT_SIDEBAR_WIDTH;
    const storedValue = Number.parseInt(
      localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY) ?? "",
      10,
    );
    return Number.isFinite(storedValue)
      ? clampSidebarWidth(storedValue)
      : DEFAULT_SIDEBAR_WIDTH;
  }

  function clampSidebarWidth(value: number) {
    return Math.min(
      MAX_SIDEBAR_WIDTH,
      Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)),
    );
  }

  function startSidebarResize(event: PointerEvent) {
    event.preventDefault();
    resizing = true;
    resizeStartX = event.clientX;
    resizeStartWidth = sidebarWidth;
    previousBodyCursor = document.body.style.cursor;
    previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleSidebarResizeMove);
    window.addEventListener("pointerup", stopSidebarResize, { once: true });
  }

  function handleSidebarResizeMove(event: PointerEvent) {
    if (!resizing) return;
    event.preventDefault();
    sidebarWidth = clampSidebarWidth(
      resizeStartWidth + event.clientX - resizeStartX,
    );
  }

  function stopSidebarResize() {
    if (!resizing) return;
    resizing = false;
    document.body.style.cursor = previousBodyCursor;
    document.body.style.userSelect = previousBodyUserSelect;
    window.removeEventListener("pointermove", handleSidebarResizeMove);
    window.removeEventListener("pointerup", stopSidebarResize);
  }

  function handleSidebarResizeKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 32 : 16;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      sidebarWidth = clampSidebarWidth(sidebarWidth - step);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      sidebarWidth = clampSidebarWidth(sidebarWidth + step);
    } else if (event.key === "Home") {
      event.preventDefault();
      sidebarWidth = MIN_SIDEBAR_WIDTH;
    } else if (event.key === "End") {
      event.preventDefault();
      sidebarWidth = MAX_SIDEBAR_WIDTH;
    }
  }

  onDestroy(stopSidebarResize);
</script>

<Sidebar.Provider
  class="h-screen overflow-hidden bg-sidebar text-foreground"
  style={sidebarWidthStyle}
>
  <Sidebar.Root collapsible="icon" showBorder={false}>
    <div class="relative flex h-full min-h-0 flex-col">
      <div
        class="flex min-h-0 flex-1 flex-col group-data-[collapsible=icon]:hidden"
      >
        <Sidebar.Header class="gap-3">
          <StudioShellHeader
            projectName={snapshot?.project.name ?? "Loading project"}
            onOpenLedgerSettings={() => (tab = "workspace")}
          />
          <div
            class="grid w-full grid-cols-3 gap-1 rounded-md border border-sidebar-border bg-sidebar-accent/50 p-1"
          >
            <Button
              variant="ghost"
              size="icon"
              class={tab === "projects"
                ? "h-8 w-full border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                : "h-8 w-full border border-transparent text-muted-foreground hover:text-sidebar-foreground"}
              aria-label="Projects"
              title="Projects"
              onclick={() => (tab = "projects")}><FolderOpen /></Button
            >
            <Button
              variant="ghost"
              size="icon"
              class={tab === "workspace"
                ? "h-8 w-full border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                : "h-8 w-full border border-transparent text-muted-foreground hover:text-sidebar-foreground"}
              aria-label="Workspace"
              title="Workspace"
              onclick={() => (tab = "workspace")}><LayoutPanelLeft /></Button
            >
            <Button
              variant="ghost"
              size="icon"
              class={tab === "search"
                ? "h-8 w-full border border-sidebar-border bg-background text-sidebar-accent-foreground shadow-sm hover:bg-background"
                : "h-8 w-full border border-transparent text-muted-foreground hover:text-sidebar-foreground"}
              aria-label="Search"
              title="Search"
              onclick={() => (tab = "search")}><SearchIcon /></Button
            >
          </div>
        </Sidebar.Header>
        <Sidebar.Content class="px-2 pb-3">
          {#if tab === "projects"}
            <Sidebar.Group>
              <Sidebar.GroupLabel>Current project</Sidebar.GroupLabel>
              <Sidebar.GroupContent class="flex flex-col gap-1">
                {#if snapshot}
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-auto w-full justify-start border border-sidebar-border bg-background py-2 text-sidebar-accent-foreground shadow-sm hover:bg-background hover:text-sidebar-accent-foreground"
                    title={snapshot.project.name}
                    aria-current="page"
                    onclick={() => void onSelectProject(snapshot!.project.id)}
                  >
                    <FolderOpen data-icon="inline-start" />
                    <span class="min-w-0 text-left"
                      ><span class="block truncate"
                        >{snapshot.project.name}</span
                      ><span
                        class="block truncate text-xs text-muted-foreground"
                        >{snapshot.project.entryFile}</span
                      ></span
                    >
                  </Button>
                {:else}
                  <p class="px-2 text-sm text-muted-foreground">
                    Opening project…
                  </p>
                {/if}
                {#each projects.filter((project) => project.id !== snapshot?.project.id) as project (project.id)}
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-auto w-full justify-start py-2"
                    title={project.name}
                    onclick={() => void onSelectProject(project.id)}
                  >
                    <FolderOpen data-icon="inline-start" />
                    <span class="min-w-0 text-left"
                      ><span class="block truncate">{project.name}</span><span
                        class="block truncate text-xs text-muted-foreground"
                        >{project.entryFile}</span
                      ></span
                    >
                  </Button>
                {/each}
              </Sidebar.GroupContent>
            </Sidebar.Group>
            <Separator class="my-2" />
            <div class="px-2">
              {#if projectActionError}
                <p
                  class="mb-2 px-1 text-xs text-destructive"
                  role="alert"
                  data-project-action-error
                >
                  {projectActionError}
                </p>
              {/if}
              {#if enteringPath}
                <form
                  class="flex flex-col gap-2"
                  onsubmit={(event) => {
                    event.preventDefault();
                    void submitPath();
                  }}
                >
                  <StructuredForm
                    config={projectPathForm}
                    value={{ path }}
                    context={undefined}
                    onChange={(value) => (path = value.path)}
                  />
                  <div class="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      class="flex-1"
                      disabled={addingProject || !path.trim()}>Add</Button
                    ><Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={addingProject}
                      onclick={cancelPathEntry}>Cancel</Button
                    >
                  </div>
                </form>
              {:else}
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full justify-start"
                  disabled={addingProject}
                  onclick={() => void openProject()}
                >
                  <Plus data-icon="inline-start" /><span
                    >{addingProject
                      ? "Opening folder…"
                      : "Open another project"}</span
                  >
                </Button>
              {/if}
            </div>
          {:else if tab === "search"}
            <div data-slot="search-tab" class="flex min-h-0 flex-1 flex-col">
              <slot name="search"></slot>
            </div>
          {:else}
            <slot name="workspace"></slot>
          {/if}
        </Sidebar.Content>
      </div>

      <div
        class="hidden h-full min-h-0 flex-col items-center gap-2 px-1.5 py-2 group-data-[collapsible=icon]:flex"
      >
        <Sidebar.Trigger
          class="size-8"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRight />
          <span class="sr-only">Expand sidebar</span>
        </Sidebar.Trigger>
        <Sidebar.Trigger
          class="flex min-h-0 flex-1 items-center justify-center rounded-md border border-transparent px-1 py-2 text-sidebar-foreground hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Expand project rail"
          title={snapshot?.project.name ?? "Beancount Studio"}
        >
          <span
            class="max-h-full truncate text-[12px] font-semibold [writing-mode:vertical-rl]"
          >
            {snapshot?.project.name ?? "Beancount Studio"}
          </span>
        </Sidebar.Trigger>
      </div>

      <div
        role="slider"
        tabindex="0"
        class="absolute -right-1.5 bottom-4 top-4 z-20 hidden w-3 cursor-col-resize items-stretch justify-center rounded-full bg-transparent outline-none group-data-[collapsible=icon]:hidden md:flex"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={sidebarWidth}
        title="Resize sidebar"
        onpointerdown={startSidebarResize}
        onkeydown={handleSidebarResizeKeydown}
        onpointerenter={() => (hoveringResizer = true)}
        onpointerleave={() => (hoveringResizer = false)}
        onfocus={() => (hoveringResizer = true)}
        onblur={() => (hoveringResizer = false)}
      >
        <span
          class={cn(
            "my-2.5 w-px bg-transparent transition-colors",
            (resizing || hoveringResizer) && "bg-primary/60",
          )}
          aria-hidden="true"
        ></span>
      </div>
    </div>
  </Sidebar.Root>
  <div
    data-slot="studio-workspace-shell"
    class="flex min-w-0 flex-1 gap-2 p-2 md:pl-0"
  >
    <main
      class="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm dark:shadow-[0_2px_8px_oklch(0_0_0/0.5)]"
    >
      <div
        data-slot="studio-workspace-header"
        class="flex h-11 shrink-0 items-center border-b border-border px-3"
      >
        <Sidebar.Trigger
          class="md:hidden"
          aria-label="Show navigation"
          title="Show navigation"
        />
        <Sidebar.Trigger
          class="hidden size-8 md:inline-flex"
          aria-label="Collapse sidebar to project rail"
          title="Collapse sidebar"
        />
        <span
          data-workspace-page-title
          class="ml-1 min-w-0 truncate text-sm font-semibold"
        >
          {pageTitle}
        </span>
        {#if $ingestionHeaderActions?.kind === "rules"}
          <span
            class="ml-1.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
            >{$ingestionHeaderActions.ruleCount}</span
          >
        {/if}
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <div
            data-slot="studio-workspace-header-actions"
            class="flex min-w-0 items-center gap-2"
          >
            <IngestionHeaderActions />
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            aria-label="Toggle theme"
            title="Toggle theme"
            onclick={toggleMode}
          >
            <span class="relative grid place-items-center">
              <Sun
                class="transition-[transform,opacity] motion-reduce:transition-none dark:-rotate-90 dark:opacity-0"
              />
              <Moon
                class="absolute rotate-90 opacity-0 transition-[transform,opacity] motion-reduce:transition-none dark:rotate-0 dark:opacity-100"
              />
            </span>
          </Button>
        </div>
      </div>
      {#if $activeSyncTracks.some((track) => track.job.status === "queued" || track.job.status === "running")}
        {@const track = $activeSyncTracks.find(
          (item) =>
            item.job.status === "queued" || item.job.status === "running",
        )}
        {#if track}
          <div
            class="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
            role="status"
            data-ingestion-sync-banner
          >
            <RefreshCw
              class="size-3.5 shrink-0 animate-spin"
              aria-hidden="true"
            />
            <span class="min-w-0 truncate">
              Syncing {track.sourceName}: {track.job.progress.message}
            </span>
          </div>
        {/if}
      {/if}
      <div class="min-h-0 min-w-0 flex-1 overflow-hidden">
        {#if snapshot}
          <slot></slot>
        {:else}
          <Empty.Root>
            <Empty.Header>
              <Empty.Media variant="icon"><FolderOpen /></Empty.Media>
              <Empty.Title>Open a ledger project</Empty.Title>
              <Empty.Description>
                Choose the folder that contains your Beancount entry file to
                start working.
              </Empty.Description>
            </Empty.Header>
            <Empty.Content>
              <Button onclick={() => void openProject()}>
                <FolderOpen data-icon="inline-start" />
                Open project
              </Button>
              {#if status && !status.startsWith("Loading") && !status.startsWith("Add a local")}
                <Empty.Description role="alert" class="text-destructive">
                  {status}
                </Empty.Description>
              {/if}
            </Empty.Content>
          </Empty.Root>
        {/if}
      </div>
    </main>
    <slot name="ai"></slot>
  </div>
</Sidebar.Provider>
