<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { Separator } from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Layout/Separator",
    component: Separator,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local separator for grouping adjacent controls or metadata. Use it sparingly; structured form rows provide their own separators.",
        },
      },
    },
  });
</script>

<Story name="Separates compact metadata">
  {#snippet template()}
    <div class="flex max-w-md items-center gap-3 text-sm">
      <span>personal-2026.beancount</span>
      <Separator orientation="vertical" class="h-4" />
      <span class="text-muted-foreground">Saved just now</span>
    </div>
  {/snippet}
</Story>
