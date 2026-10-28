<script lang="ts">
  import FolderOpen from "lucide-svelte/icons/folder-open";
  import Plus from "lucide-svelte/icons/plus";
  import { Button } from "../shadcn/button";
  import { Separator } from "../shadcn/separator";

  export type ProjectSwitcherItem = {
    /** Stable application-owned identifier used for the selected project. */
    id: string;
    name: string;
    /** Usually an entry file or other compact project detail. */
    detail?: string;
    disabled?: boolean;
  };

  /**
   * Router- and filesystem-independent project navigation. Applications keep
   * project discovery, folder pickers, persistence, and routes outside this
   * display component.
   */
  let {
    projects,
    currentProjectId,
    ariaLabel = "Project switcher",
    emptyLabel = "No saved projects are available.",
    addLabel = "Open another project",
    addPending = false,
    onSelect,
    onAdd,
  }: {
    projects: readonly ProjectSwitcherItem[];
    currentProjectId?: string;
    ariaLabel?: string;
    emptyLabel?: string;
    addLabel?: string;
    addPending?: boolean;
    onSelect?: (project: ProjectSwitcherItem) => void;
    onAdd?: () => void;
  } = $props();

  const currentProject = $derived(
    projects.find((project) => project.id === currentProjectId),
  );
  const otherProjects = $derived(
    projects.filter((project) => project.id !== currentProjectId),
  );
</script>

<nav class="cn-navigation-projectswitcher-49-1" aria-label={ariaLabel}>
  <section class="cn-navigation-projectswitcher-50-1">
    <p class="cn-navigation-projectswitcher-51-1">Current project</p>
    {#if currentProject}
      {@render ProjectButton({
        project: currentProject,
        current: true,
        onSelect,
      })}
    {:else}
      <p class="cn-navigation-projectswitcher-61-1">{emptyLabel}</p>
    {/if}
  </section>

  {#if otherProjects.length}
    <section
      class="cn-navigation-projectswitcher-66-1"
      aria-label="Other projects"
    >
      {#each otherProjects as project (project.id)}
        {@render ProjectButton({ project, onSelect })}
      {/each}
    </section>
  {/if}

  <Separator />
  <Button
    type="button"
    variant="outline"
    size="sm"
    class="cn-navigation-projectswitcher-78-1"
    disabled={addPending || !onAdd}
    onclick={() => onAdd?.()}
  >
    <Plus data-icon="inline-start" />
    {addPending ? "Opening folder…" : addLabel}
  </Button>
</nav>

{#snippet ProjectButton({
  project,
  current = false,
  onSelect,
}: {
  project: ProjectSwitcherItem;
  current?: boolean;
  onSelect?: (project: ProjectSwitcherItem) => void;
})}
  <Button
    type="button"
    variant="ghost"
    size="sm"
    class={current
      ? "cn-navigation-projectswitcher-101-1"
      : "cn-navigation-projectswitcher-102-1"}
    title={project.name}
    aria-current={current ? "page" : undefined}
    disabled={project.disabled || !onSelect}
    onclick={() => onSelect?.(project)}
  >
    <FolderOpen data-icon="inline-start" />
    <span class="cn-navigation-projectswitcher-109-1">
      <span class="cn-navigation-projectswitcher-110-1">{project.name}</span>
      {#if project.detail}
        <span class="cn-navigation-projectswitcher-112-1">
          {project.detail}
        </span>
      {/if}
    </span>
  </Button>
{/snippet}
