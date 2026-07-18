<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import Switch from "./Switch.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Switch",
    component: Switch,
    parameters: {
      docs: {
        description: {
          component:
            'The shared shadcn-style control for a boolean setting. Place it in `FormField as="div" align="center"`; use Segmented Control when the user is selecting between named non-boolean modes. See the [Form guidance](?path=/docs/ui-forms-guidance--docs) for the required form treatment.',
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
    const toggle = canvas.getByRole("switch", { name: "Enable ledger" });
    await expect(toggle).toBeChecked();

    await userEvent.click(toggle);
    await expect(toggle).not.toBeChecked();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Ledger disabled",
    );
  }}
>
  {#snippet template()}
    <div class="space-y-2">
      <Switch
        checked={enabled}
        aria-label="Enable ledger"
        onCheckedChange={(checked) => (enabled = checked)}
      />
      <output class="block text-sm text-muted-foreground">
        Ledger {enabled ? "enabled" : "disabled"}
      </output>
    </div>
  {/snippet}
</Story>
