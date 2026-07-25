<script lang="ts">
  import { onDestroy } from "svelte";
  import ChevronRight from "lucide-svelte/icons/chevron-right";
  import FolderOpen from "lucide-svelte/icons/folder-open";
  import Moon from "lucide-svelte/icons/moon";
  import Sun from "lucide-svelte/icons/sun";
  import { toggleMode } from "mode-watcher";
  import type {
    ProjectSnapshot,
    ProjectSummary,
  } from "@beancount-js/workspace";
  import * as Sidebar from "@beancount-js/ui/shadcn/sidebar";
  import { Button } from "@beancount-js/ui/shadcn/button";
  import * as Empty from "@beancount-js/ui/shadcn/empty";
  import { cn } from "$lib/utils";
  import {
    FilterCommandPicker,
    StructuredForm,
    createFormConfig,
    textField,
    type FilterCommandOption,
  } from "@beancount-js/ui/forms";
  import AppShell from "@beancount-js/ui/app-shell";
  import StudioShellHeader from "./StudioShellHeader.svelte";
  import IngestionHeaderActions from "./IngestionHeaderActions.svelte";
  import RouteLoadingSkeleton from "./skeletons/RouteLoadingSkeleton.svelte";
  import { activeSyncTracks } from "../studio/sync-status";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
  import RefreshCw from "lucide-svelte/icons/refresh-cw";

  export let projects: ProjectSummary[] = [];
  export let snapshot: ProjectSnapshot | undefined;
  export let isWeb = false;
  export let status = "";
  export let pageTitle = "Beancount Studio";
  export let routePath = "";
  export let onSelectProject: (id: string) => void | Promise<void>;
  export let onAddProject: (path?: string) => void | Promise<void>;

  const SIDEBAR_WIDTH_STORAGE_KEY = "beancount-studio:sidebar-width";
  const DEFAULT_SIDEBAR_WIDTH = 256;
  const MIN_SIDEBAR_WIDTH = 220;
  const MAX_SIDEBAR_WIDTH = 520;

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
  let projectOptions: FilterCommandOption[] = [];

  $: sidebarWidthStyle = `--sidebar-width: ${sidebarWidth}px;`;
  $: projectOptions = projects.map<FilterCommandOption>((project) => ({
    value: project.id,
    label: project.name,
    description: project.entryFile,
    keywords: [project.entryFile],
  }));
  $: if (typeof localStorage !== "undefined") {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
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
  class="cn-beta-components-studioshell-216-1"
  style={sidebarWidthStyle}
>
  <AppShell {pageTitle} hasSidebar>
    <svelte:fragment slot="sidebar">
      <Sidebar.Root collapsible="icon" showBorder={false}>
        <div class="cn-beta-components-studioshell-220-1">
          <div class="cn-beta-components-studioshell-222-1">
            <Sidebar.Header>
              <StudioShellHeader
                projectName={snapshot?.project.name ?? "Loading project"}
              />
            </Sidebar.Header>
            <Sidebar.Content class="cn-beta-components-studioshell-229-1">
              <slot name="workspace"></slot>
            </Sidebar.Content>
          </div>
          <Sidebar.Footer class="cn-beta-components-studioshell-234-1">
            <FilterCommandPicker
              label="Project"
              ariaLabel="Select project"
              placeholder="Search projects..."
              emptyLabel="No projects found."
              fullWidth
              stackedOptions
              options={projectOptions}
              value={snapshot?.project.id ?? ""}
              onChange={(id) => void onSelectProject(id)}
            />
          </Sidebar.Footer>

          <div class="cn-beta-components-studioshell-250-1">
            <Sidebar.Trigger
              class="cn-beta-components-studioshell-253-1"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight />
              <span class="sr-only">Expand sidebar</span>
            </Sidebar.Trigger>
            <Sidebar.Trigger
              class="cn-beta-components-studioshell-261-1"
              aria-label="Expand project rail"
              title={snapshot?.project.name ?? "Beancount Studio"}
            >
              <span class="cn-beta-components-studioshell-266-1">
                {snapshot?.project.name ?? "Beancount Studio"}
              </span>
            </Sidebar.Trigger>
          </div>

          <div
            role="slider"
            tabindex="0"
            class="cn-beta-components-studioshell-276-1"
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
                "cn-beta-components-studioshell-292-1",
                (resizing || hoveringResizer) &&
                  "cn-beta-components-studioshell-293-1",
              )}
              aria-hidden="true"
            ></span>
          </div>
        </div>
      </Sidebar.Root>
    </svelte:fragment>
    <svelte:fragment slot="mobile-navigation-trigger">
      <Sidebar.Trigger
        class="cn-beta-components-studioshell-303-1"
        aria-label="Show navigation"
        title="Show navigation"
      />
    </svelte:fragment>
    <svelte:fragment slot="desktop-sidebar-trigger">
      <Sidebar.Trigger
        class="cn-beta-components-studioshell-310-1"
        aria-label="Collapse sidebar to project rail"
        title="Collapse sidebar"
      />
    </svelte:fragment>
    <svelte:fragment slot="title-trailing">
      {#if $ingestionHeaderActions?.kind === "rules"}
        <span class="cn-beta-components-studioshell-318-1"
          >{$ingestionHeaderActions.ruleCount}</span
        >
      {/if}
      {#if $ingestionHeaderActions?.kind === "manage-merchants"}
        <span class="cn-beta-components-studioshell-324-1"
          >{$ingestionHeaderActions.merchantCount}</span
        >
      {/if}
      {#if $ingestionHeaderActions?.kind === "history"}
        <span class="cn-beta-components-studioshell-330-1"
          >{$ingestionHeaderActions.runCount}</span
        >
      {/if}
      {#if $ingestionHeaderActions?.kind === "review"}
        <span
          class="cn-beta-components-studioshell-336-1"
          aria-label={`${$ingestionHeaderActions.recordCount} total records`}
          title={`${$ingestionHeaderActions.recordCount} total records`}
          >{$ingestionHeaderActions.recordCount}</span
        >
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="header-leading">
      {#if $ingestionHeaderActions?.kind === "ledger"}
        <div
          data-slot="studio-workspace-header-leading"
          class="cn-beta-components-studioshell-347-1"
        >
          <IngestionHeaderActions region="leading" />
        </div>
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="header-actions">
      <div
        data-slot="studio-workspace-header-actions"
        class="cn-beta-components-studioshell-356-1"
      >
        <IngestionHeaderActions region="actions" />
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="cn-beta-components-studioshell-363-1"
        aria-label="Toggle theme"
        title="Toggle theme"
        onclick={toggleMode}
      >
        <span class="cn-beta-components-studioshell-368-1">
          <Sun class="cn-beta-components-studioshell-370-1" />
          <Moon class="cn-beta-components-studioshell-373-1" />
        </span>
      </Button>
    </svelte:fragment>
    <svelte:fragment slot="status">
      {#if $activeSyncTracks.some((track) => track.job.status === "queued" || track.job.status === "running")}
        {@const track = $activeSyncTracks.find(
          (item) =>
            item.job.status === "queued" || item.job.status === "running",
        )}
        {#if track}
          <div
            class="cn-beta-components-studioshell-386-1"
            role="status"
            data-ingestion-sync-banner
          >
            <RefreshCw
              class="cn-beta-components-studioshell-391-1"
              aria-hidden="true"
            />
            <span class="cn-beta-components-studioshell-394-1">
              Syncing {track.sourceName}: {track.job.progress.message}
            </span>
          </div>
        {/if}
      {/if}
    </svelte:fragment>
    {#if snapshot}
      <slot></slot>
    {:else if status.startsWith("Loading")}
      <RouteLoadingSkeleton {routePath} />
    {:else}
      <Empty.Root>
        <Empty.Header>
          <Empty.Media variant="icon"><FolderOpen /></Empty.Media>
          <Empty.Title>Open a ledger project</Empty.Title>
          <Empty.Description>
            Choose the folder that contains your Beancount entry file to start
            working.
          </Empty.Description>
        </Empty.Header>
        <Empty.Content>
          {#if enteringPath}
            <form
              class="cn-beta-components-studioshell-418-1"
              onsubmit={(event) => {
                event.preventDefault();
                void submitPath();
              }}
            >
              <StructuredForm
                config={projectPathForm}
                value={{ path }}
                context={undefined}
                onChange={(value) => {
                  path = value.path;
                }}
              />
              <div class="cn-beta-components-studioshell-432-1">
                <Button
                  type="submit"
                  class="cn-beta-components-studioshell-435-1"
                  disabled={addingProject || !path.trim()}>Open project</Button
                ><Button
                  type="button"
                  variant="ghost"
                  disabled={addingProject}
                  onclick={cancelPathEntry}>Cancel</Button
                >
              </div>
            </form>
          {:else}
            <Button disabled={addingProject} onclick={() => void openProject()}>
              <FolderOpen data-icon="inline-start" />
              {addingProject ? "Opening folder…" : "Open project"}
            </Button>
          {/if}
          {#if projectActionError}
            <Empty.Description
              role="alert"
              class="cn-beta-components-studioshell-452-1"
            >
              {projectActionError}
            </Empty.Description>
          {/if}
          {#if status && !status.startsWith("Add a local")}
            <Empty.Description
              role="alert"
              class="cn-beta-components-studioshell-457-1"
            >
              {status}
            </Empty.Description>
          {/if}
        </Empty.Content>
      </Empty.Root>
    {/if}
    <svelte:fragment slot="ai"><slot name="ai"></slot></svelte:fragment>
  </AppShell>
</Sidebar.Provider>
