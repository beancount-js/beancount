<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import { Button } from "../button";
  import * as DropdownMenu from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Overlays/Dropdown Menu",
    component: DropdownMenu.Root,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned compact action menu. Use clear action labels, checked items for independent settings, and separators between unrelated groups.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let showUnreviewed = $state(false);
</script>

<Story
  name="Changes a menu setting"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Transaction filters" }),
    );
    const menu = within(document.body).getByRole("menu");
    const option = within(menu).getByRole("menuitemcheckbox", {
      name: "Show unreviewed only",
    });
    await userEvent.click(option);
    await expect(option).toHaveAttribute("aria-checked", "true");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "unreviewed only",
    );
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline">Transaction filters</Button>
          {/snippet}
        </DropdownMenu.Trigger>
        <DropdownMenu.Content>
          <DropdownMenu.Label>Filters</DropdownMenu.Label>
          <DropdownMenu.CheckboxItem bind:checked={showUnreviewed}>
            Show unreviewed only
          </DropdownMenu.CheckboxItem>
          <DropdownMenu.Separator />
          <DropdownMenu.Item onclick={() => (showUnreviewed = false)}>
            Clear filters
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <output class="text-sm text-muted-foreground">
        Showing {showUnreviewed ? "unreviewed only" : "all transactions"}.
      </output>
    </div>
  {/snippet}
</Story>
