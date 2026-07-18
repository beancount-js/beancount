<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import * as Resizable from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Layout/Resizable",
    component: Resizable.PaneGroup,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local pane layout for persistent, user-resizable desktop regions. Set sensible minimum sizes so working content remains usable.",
        },
      },
    },
  });
</script>

<Story name="Splits a workspace into panes">
  {#snippet template()}
    <div class="h-56 max-w-2xl overflow-hidden rounded-md border">
      <Resizable.PaneGroup direction="horizontal" aria-label="Ledger workspace">
        <Resizable.Pane defaultSize={35} minSize={20}>
          <div class="h-full bg-muted p-4 text-sm">Account navigation</div>
        </Resizable.Pane>
        <Resizable.Handle withHandle />
        <Resizable.Pane defaultSize={65} minSize={30}>
          <div class="h-full p-4 text-sm">Transaction details</div>
        </Resizable.Pane>
      </Resizable.PaneGroup>
    </div>
  {/snippet}
</Story>
