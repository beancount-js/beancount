<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import { Button } from "../button";
  import * as Dialog from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Overlays/Dialog",
    component: Dialog.Root,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned dialog for focused editing or detail work. Use a descriptive title and retain a visible close affordance.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let open = $state(false);
</script>

<Story
  name="Opens and closes an editor dialog"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Edit ledger" }));
    const dialog = within(document.body).getByRole("dialog", {
      name: "Edit ledger details",
    });
    await expect(dialog).toHaveAttribute("data-state", "open");
    await userEvent.keyboard("{Escape}");
    await expect(canvas.getByRole("status")).toHaveTextContent("closed");
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <Dialog.Root bind:open>
        <Dialog.Trigger>
          {#snippet child({ props })}
            <Button {...props}>Edit ledger</Button>
          {/snippet}
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Edit ledger details</Dialog.Title>
            <Dialog.Description>
              Change the display name used throughout your workspace.
            </Dialog.Description>
          </Dialog.Header>
          <label class="grid gap-2 text-sm" for="catalog-ledger-name">
            Ledger name
            <input
              class="h-9 rounded-md border bg-background px-3"
              id="catalog-ledger-name"
              value="Northstar Ledger"
            />
          </label>
          <Dialog.Footer>
            <Button>Save changes</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
      <output class="text-sm text-muted-foreground">
        Editor is {open ? "open" : "closed"}.
      </output>
    </div>
  {/snippet}
</Story>
