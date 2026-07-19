<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import * as Tabs from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Disclosure/Tabs",
    component: Tabs.Root,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned tab composition for switching between peer views without changing the page context.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let activeTab = $state("transactions");
</script>

<Story
  name="Changes the active view"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("tab", { name: "Balances" }));
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent(
      "Current account balances",
    );
  }}
>
  {#snippet template()}
    <Tabs.Root bind:value={activeTab} class="max-w-xl">
      <Tabs.List aria-label="Account data">
        <Tabs.Trigger value="transactions">Transactions</Tabs.Trigger>
        <Tabs.Trigger value="balances">Balances</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="transactions">Recent transactions</Tabs.Content>
      <Tabs.Content value="balances">Current account balances</Tabs.Content>
    </Tabs.Root>
  {/snippet}
</Story>
