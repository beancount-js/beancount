<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import StudioShellHeader from "./StudioShellHeader.svelte";

  const { Story } = defineMeta({
    title: "Fava/Layout/Studio Shell Header",
    component: StudioShellHeader,
    parameters: {
      docs: {
        description: {
          component:
            "The Fava-local workspace identity and settings control used at the top of the Studio sidebar. It keeps project context visible while synchronising the ledger-settings navigation state.",
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

  let settingsOpened = $state(false);
</script>

<Story
  name="Opens ledger settings"
  play={async ({ canvas }) => {
    const settings = canvas.getByRole("button", { name: "Ledger settings" });
    await expect(settings).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(settings);
    await expect(settings).toHaveAttribute("aria-pressed", "true");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Settings opened",
    );
  }}
>
  {#snippet template()}
    <div
      class="max-w-sm rounded-xl border bg-sidebar p-3 text-sidebar-foreground"
    >
      <StudioShellHeader
        projectName="northstar-ledger"
        onOpenLedgerSettings={() => {
          settingsOpened = true;
        }}
      />
      <output class="sr-only" aria-live="polite">
        {settingsOpened ? "Settings opened" : "Settings closed"}
      </output>
    </div>
  {/snippet}
</Story>
