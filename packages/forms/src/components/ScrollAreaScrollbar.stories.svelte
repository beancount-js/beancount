<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";
  import { ScrollArea } from "bits-ui";
  import ScrollAreaScrollbar from "./ScrollAreaScrollbar.svelte";

  const { Story } = defineMeta({
    title: "Forms/Legacy/Scroll Area Scrollbar",
    component: ScrollAreaScrollbar,
    parameters: {
      docs: {
        description: {
          component:
            "The compatibility scrollbar paired with the legacy Forms Scroll Area. It has no standalone use; select the Fava-local Shadcn scroll area for new work.",
        },
      },
    },
  });
</script>

<Story
  name="Shows the legacy vertical scrollbar"
  play={async ({ canvas }) => {
    await expect(
      canvas.getByLabelText("Scrollable legacy content"),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <ScrollArea.Root
      class="relative h-32 max-w-md overflow-hidden rounded-md border border-border"
      aria-label="Scrollable legacy content"
    >
      <ScrollArea.Viewport class="h-full w-full rounded-[inherit]" tabindex="0">
        <div class="flex flex-col gap-2 p-3 text-sm">
          {#each Array.from({ length: 12 }) as _, index}
            <span>Legacy item {index + 1}</span>
          {/each}
        </div>
      </ScrollArea.Viewport>
      <ScrollAreaScrollbar orientation="vertical" />
      <ScrollArea.Corner />
    </ScrollArea.Root>
  {/snippet}
</Story>
