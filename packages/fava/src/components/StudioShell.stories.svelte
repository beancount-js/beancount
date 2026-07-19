<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
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
