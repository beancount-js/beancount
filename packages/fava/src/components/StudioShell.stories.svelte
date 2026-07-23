<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import type {
    ProjectSnapshot,
    ProjectSummary,
  } from "@beancount-js/workspace";
  import StudioShell from "./StudioShell.svelte";

  const { Story } = defineMeta({
    title: "Fava/Layout/Studio Shell",
    component: StudioShell,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's application shell around the shared App Shell. It owns the Studio project rail, workspace tabs, project-empty state, shell actions, and responsive sidebar behaviour; route pages compose inside it rather than recreating chrome.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import {
    setStudioWorkspace,
    createStudioWorkspace,
  } from "../studio/workspace";

  const workspace = createStudioWorkspace(
    async () => {},
    async () => ({}) as never,
    async () => null,
    async () => ({ url: "", mimeType: "text/plain" }),
    () => {},
  );
  setStudioWorkspace(workspace);

  let projectRequested = $state(false);
  let selectedProject = $state("");

  const snapshot = {
    project: {
      id: "northstar-ledger",
      name: "Northstar Ledger",
      entryFile: "ledgers/personal.beancount",
      updatedAt: "2026-07-23T09:00:00.000Z",
      createdAt: "2026-07-01T09:00:00.000Z",
      version: 1,
    },
    ledgerFiles: [],
    resources: [],
    revisions: [],
    issues: [],
    envKeys: [],
  } satisfies ProjectSnapshot;

  const projects = [
    snapshot.project,
    {
      id: "household-ledger",
      name: "Household Ledger",
      entryFile: "main.beancount",
      updatedAt: "2026-07-20T09:00:00.000Z",
    },
  ] satisfies ProjectSummary[];
</script>

<Story
  name="Guides a user to open a ledger project"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Open project" }));
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Project action requested",
    );
  }}
>
  {#snippet template()}
    <div
      class="h-[42rem] overflow-hidden rounded-xl border bg-background shadow-sm"
    >
      <StudioShell
        projects={[]}
        snapshot={undefined}
        isWeb={true}
        status=""
        pageTitle="Beancount Studio"
        routePath="/dashboard"
        onSelectProject={async () => {}}
        onAddProject={async () => {
          projectRequested = true;
        }}
      />
    </div>
    <output class="sr-only" aria-live="polite">
      {projectRequested ? "Project action requested" : "No project action"}
    </output>
  {/snippet}
</Story>

<Story
  name="Selects a project from the sidebar footer"
  play={async ({ canvas, canvasElement }) => {
    const projectPicker = canvas.getByRole("button", {
      name: "Select project",
    });
    await expect(projectPicker).toHaveTextContent("Northstar Ledger");
    await expect(
      canvas.queryByRole("button", { name: "Projects" }),
    ).not.toBeInTheDocument();

    await userEvent.click(projectPicker);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      page.getByRole("option", { name: /Household Ledger/ }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "household-ledger",
    );
  }}
>
  {#snippet template()}
    <div
      class="h-[42rem] overflow-hidden rounded-xl border bg-background shadow-sm"
    >
      <StudioShell
        {projects}
        {snapshot}
        isWeb={true}
        status=""
        pageTitle="Beancount Studio"
        routePath="/dashboard"
        onSelectProject={async (id) => {
          selectedProject = id;
        }}
        onAddProject={async () => {}}
      >
        <svelte:fragment slot="workspace">
          <p class="p-3 text-sm text-muted-foreground">Workspace content</p>
        </svelte:fragment>
        <svelte:fragment slot="search">
          <p class="p-3 text-sm text-muted-foreground">Search content</p>
        </svelte:fragment>
      </StudioShell>
    </div>
    <output class="sr-only" aria-live="polite">
      {selectedProject || "No project selected"}
    </output>
  {/snippet}
</Story>
