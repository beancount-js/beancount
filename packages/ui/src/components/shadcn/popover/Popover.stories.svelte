<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { Button } from "../button";
  import * as Popover from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Overlays/Popover",
    component: Popover.Root,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned popover for small contextual settings. Keep the task short and use a dialog when it needs a larger editing workflow.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let open = $state(false);
</script>

<Story
  name="Opens contextual settings"
  play={async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Import settings" });
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(canvas.getByRole("status")).toHaveTextContent("open");
    await userEvent.keyboard("{Escape}");
    await expect(canvas.getByRole("status")).toHaveTextContent("closed");
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <Popover.Root bind:open>
        <Popover.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline">Import settings</Button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Content>
          <div class="space-y-3">
            <div>
              <h3 class="font-medium">Import settings</h3>
              <p class="text-sm text-muted-foreground">
                Transactions are imported every four hours.
              </p>
            </div>
            <Popover.Close>
              {#snippet child({ props })}
                <Button {...props} size="sm" variant="outline"
                  >Close settings</Button
                >
              {/snippet}
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Root>
      <output class="text-sm text-muted-foreground">
        Settings are {open ? "open" : "closed"}.
      </output>
    </div>
  {/snippet}
</Story>
