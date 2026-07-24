<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import * as Menubar from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Overlays/Menubar",
    component: Menubar.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local desktop-style menubar for grouped editor commands. Use it for persistent command categories, not contextual row actions.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let showLineNumbers = $state(true);
</script>

<Story
  name="Changes an editor setting"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("menuitem", { name: "View" }));
    const menu = within(document.body).getByRole("menu");
    const option = within(menu).getByRole("menuitemcheckbox", {
      name: "Show line numbers",
    });
    await userEvent.click(option);
    await expect(option).toHaveAttribute("aria-checked", "false");
    await expect(canvas.getByRole("status")).toHaveTextContent("hidden");
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <Menubar.Root>
        <Menubar.Menu>
          <Menubar.Trigger>View</Menubar.Trigger>
          <Menubar.Content>
            <Menubar.CheckboxItem bind:checked={showLineNumbers}>
              Show line numbers
            </Menubar.CheckboxItem>
            <Menubar.Separator />
            <Menubar.Item>Toggle word wrap</Menubar.Item>
          </Menubar.Content>
        </Menubar.Menu>
      </Menubar.Root>
      <output class="text-sm text-muted-foreground">
        Line numbers are {showLineNumbers ? "visible" : "hidden"}.
      </output>
    </div>
  {/snippet}
</Story>
