<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { Skeleton } from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Layout/Skeleton",
    component: Skeleton,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned loading placeholder. Match the eventual content structure so loading does not cause a disruptive layout shift.",
        },
      },
    },
  });
</script>

<Story name="Reserves transaction list space">
  {#snippet template()}
    <div
      class="max-w-xl space-y-4"
      role="status"
      aria-label="Loading transactions"
      aria-busy="true"
    >
      <Skeleton class="h-7 w-40" />
      {#each Array(3) as _, index}
        <div
          class="flex items-center justify-between rounded-md border p-3"
          aria-hidden="true"
        >
          <div class="space-y-2">
            <Skeleton class="h-4 w-32" />
            <Skeleton class="h-3 w-48" />
          </div>
          <Skeleton class="h-4 w-12" />
        </div>
      {/each}
    </div>
  {/snippet}
</Story>
