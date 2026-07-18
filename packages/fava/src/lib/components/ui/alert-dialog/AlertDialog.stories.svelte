<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import { Button } from "$lib/components/ui/button";
  import * as AlertDialog from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Overlays/Alert Dialog",
    component: AlertDialog.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local confirmation dialog for consequential, irreversible actions. State the effect clearly and offer an explicit cancel action.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let open = $state(false);
</script>

<Story
  name="Confirms a destructive action"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete ledger" }),
    );
    const dialog = within(document.body).getByRole("alertdialog", {
      name: "Delete Northstar Ledger?",
    });
    await expect(dialog).toHaveAttribute("data-state", "open");
    await userEvent.keyboard("{Escape}");
    await expect(canvas.getByRole("status")).toHaveTextContent("closed");
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <AlertDialog.Root bind:open>
        <AlertDialog.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="destructive">Delete ledger</Button>
          {/snippet}
        </AlertDialog.Trigger>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Northstar Ledger?</AlertDialog.Title>
            <AlertDialog.Description>
              This permanently removes the local ledger and its imported data.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action>Delete ledger</AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
      <output class="text-sm text-muted-foreground">
        Confirmation is {open ? "open" : "closed"}.
      </output>
    </div>
  {/snippet}
</Story>
