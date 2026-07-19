<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import ScrollArea from "./ScrollArea.svelte";

  const { Story } = defineMeta({
    title: "UI Forms/Legacy/Scroll Area",
    component: ScrollArea,
    parameters: {
      docs: {
        description: {
          component:
            "Compatibility scroll container retained for current callers. New Fava surfaces should use the documented Shadcn/Layout/Scroll Area implementation instead. See the [Form guidance](?path=/docs/ui-forms-guidance--docs).",
        },
      },
    },
  });

  const sources = [
    "main.beancount",
    "imports/monzo.beancount",
    "imports/starling.beancount",
    "imports/cash.beancount",
    "reports/budget.beancount",
    "reports/taxes.beancount",
  ];
</script>

<Story
  name="Bounds legacy source navigation"
  play={async ({ canvas }) => {
    await expect(canvas.getByLabelText("Legacy ledger sources")).toBeVisible();
  }}
>
  {#snippet template()}
    <ScrollArea
      class="h-32 max-w-md rounded-md border border-border"
      aria-label="Legacy ledger sources"
    >
      <ul class="flex flex-col gap-2 p-3 text-sm">
        {#each sources as source}
          <li>{source}</li>
        {/each}
      </ul>
    </ScrollArea>
  {/snippet}
</Story>
