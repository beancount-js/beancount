<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { Switch } from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Forms/Switch",
    component: Switch,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local shadcn switch. Shared structured forms use @beancount-js/ui/forms/Switch.svelte during the migration.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let enabled = $state(true);
</script>

<Story
  name="Changes a boolean setting"
  play={async ({ canvas }) => {
    const toggle = canvas.getByRole("switch", { name: "Enable auto-import" });
    await expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await expect(toggle).not.toBeChecked();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Auto-import disabled",
    );
  }}
>
  {#snippet template()}
    <div class="flex items-center gap-3">
      <Switch bind:checked={enabled} aria-label="Enable auto-import" />
      <output class="text-sm text-muted-foreground">
        Auto-import {enabled ? "enabled" : "disabled"}
      </output>
    </div>
  {/snippet}
</Story>
