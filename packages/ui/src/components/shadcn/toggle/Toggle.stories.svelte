<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import Toggle from "./toggle.svelte";

  const { Story } = defineMeta({
    title: "Shadcn/Actions/Toggle",
    component: Toggle,
    parameters: {
      docs: {
        description: {
          component:
            "A pressed-state action control. Use Switch for boolean configuration; use Toggle for a local display or editing preference.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let compact = $state(false);
</script>

<Story
  name="Changes a local preference"
  play={async ({ canvas }) => {
    const toggle = canvas.getByRole("button", { name: "Compact display" });
    await expect(toggle).toHaveAttribute("data-state", "off");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("data-state", "on");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Compact display enabled",
    );
  }}
>
  {#snippet template()}
    <div class="flex items-center gap-3">
      <Toggle bind:pressed={compact} aria-label="Compact display">
        Compact
      </Toggle>
      <output class="text-sm text-muted-foreground">
        Compact display {compact ? "enabled" : "disabled"}
      </output>
    </div>
  {/snippet}
</Story>
