<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import * as ScrollArea from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Layout/Scroll Area",
    component: ScrollArea.Root,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local scroll container for bounded regions such as tables, source lists, and side navigation. Give the region a visible height and an accessible label when needed.",
        },
      },
    },
  });

  const sources = [
    "main.beancount",
    "imports/monzo.beancount",
    "imports/starling.beancount",
    "imports/cash.beancount",
    "reports/2026-budget.beancount",
    "reports/2026-taxes.beancount",
  ];
</script>

<Story name="Bounds a long source list">
  {#snippet template()}
    <ScrollArea.Root
      class="h-32 max-w-md rounded-md border"
      aria-label="Ledger sources"
    >
      <ul class="space-y-2 p-3 text-sm">
        {#each sources as source}
          <li><a href={`/sources/${source}`}>{source}</a></li>
        {/each}
      </ul>
    </ScrollArea.Root>
  {/snippet}
</Story>
