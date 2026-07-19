<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import { Button } from "../button";
  import * as Sheet from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Overlays/Sheet",
    component: Sheet.Root,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned side sheet for focused detail and editing work that benefits from preserving page context.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let open = $state(false);
</script>

<Story
  name="Opens a detail sheet"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Review import" }),
    );
    const dialog = within(document.body).getByRole("dialog", {
      name: "Import review",
    });
    await expect(dialog).toBeVisible();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Close" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("closed");
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <Sheet.Root bind:open>
        <Sheet.Trigger>
          {#snippet child({ props })}
            <Button {...props}>Review import</Button>
          {/snippet}
        </Sheet.Trigger>
        <Sheet.Content side="right">
          <Sheet.Header>
            <Sheet.Title>Import review</Sheet.Title>
            <Sheet.Description>
              Three transactions need a category before they can be accepted.
            </Sheet.Description>
          </Sheet.Header>
          <div class="py-4 text-sm">Groceries · £42.17</div>
          <Sheet.Footer>
            <Button>Accept reviewed items</Button>
          </Sheet.Footer>
        </Sheet.Content>
      </Sheet.Root>
      <output class="text-sm text-muted-foreground">
        Review sheet is {open ? "open" : "closed"}.
      </output>
    </div>
  {/snippet}
</Story>
