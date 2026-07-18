<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import { Button } from "$lib/components/ui/button";
  import * as Tooltip from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Overlays/Tooltip",
    component: Tooltip.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local tooltip for concise context on icon-only or unfamiliar controls. Do not put essential instructions only in a tooltip.",
        },
      },
    },
  });
</script>

<Story
  name="Explains an icon-only control"
  play={async ({ canvas }) => {
    const trigger = canvas.getByRole("button", { name: "Refresh ledger" });
    await userEvent.hover(trigger);
    await expect(trigger).toHaveAttribute("data-state", "instant-open");
    await expect(trigger).toHaveAttribute("aria-describedby");
  }}
>
  {#snippet template()}
    <Tooltip.Provider delayDuration={0}>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              size="icon"
              variant="outline"
              aria-label="Refresh ledger"
            >
              ↻
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content
          >Reload transactions from the ledger file</Tooltip.Content
        >
      </Tooltip.Root>
    </Tooltip.Provider>
  {/snippet}
</Story>
