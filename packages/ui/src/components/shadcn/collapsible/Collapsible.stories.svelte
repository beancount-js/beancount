<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import * as Collapsible from "./index.js";

  const { Story } = defineMeta({
    title: "UI Foundation/Shadcn/Disclosure/Collapsible",
    component: Collapsible.Root,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned shadcn-svelte disclosure primitive. This migration story proves the package-safe copy before the existing Fava catalog entry is retired.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let open = $state(false);
</script>

<Story
  name="Shows optional detail"
  play={async ({ canvas }) => {
    const trigger = canvas.getByRole("button", {
      name: "Show matching rules",
    });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      canvas.getByText("Rules match payee and narration."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <Collapsible.Root bind:open class="max-w-xl rounded-lg border p-3">
      <Collapsible.Trigger class="font-medium">
        {open ? "Hide" : "Show"} matching rules
      </Collapsible.Trigger>
      <Collapsible.Content class="pt-3 text-sm text-muted-foreground">
        Rules match payee and narration.
      </Collapsible.Content>
    </Collapsible.Root>
  {/snippet}
</Story>
