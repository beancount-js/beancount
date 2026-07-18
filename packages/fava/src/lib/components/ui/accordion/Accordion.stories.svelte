<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import * as Accordion from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Disclosure/Accordion",
    component: Accordion.Root,
    parameters: {
      docs: {
        description: {
          component:
            "A local Fava disclosure for independent help or settings content. Use the shared form disclosure primitives for editable form sections.",
        },
      },
    },
  });
</script>

<Story
  name="Expands supporting content"
  play={async ({ canvas }) => {
    const trigger = canvas.getByRole("button", {
      name: /^How are balances calculated\?/,
    });
    await expect(trigger).toHaveAttribute("data-state", "closed");
    await userEvent.click(trigger);
    await expect(trigger).toHaveAttribute("data-state", "open");
    await expect(
      canvas.getByText("Balances include cleared transactions."),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <Accordion.Root type="single" collapsible class="w-full max-w-xl">
      <Accordion.Item value="balances">
        <Accordion.Trigger>How are balances calculated?</Accordion.Trigger>
        <Accordion.Content>
          Balances include cleared transactions.
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  {/snippet}
</Story>
