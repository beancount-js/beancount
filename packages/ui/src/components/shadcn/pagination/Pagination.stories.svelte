<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import * as Pagination from "./index.js";

  const { Story } = defineMeta({
    title: "Shadcn/Layout/Pagination",
    component: Pagination.Root,
    parameters: {
      docs: {
        description: {
          component:
            "UI-owned pagination composition for discrete result pages. Keep the current page visible and use explicit previous and next controls.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let page = $state(1);
</script>

<Story
  name="Changes the current page"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByText("2"));
    await expect(canvas.getByRole("status")).toHaveTextContent("Page 2");
  }}
>
  {#snippet template()}
    <div class="space-y-3">
      <Pagination.Root
        count={4}
        perPage={1}
        bind:page
        aria-label="Transaction pages"
      >
        {#snippet children({ pages, currentPage })}
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous />
            </Pagination.Item>
            {#each pages as pageItem (pageItem.key)}
              {#if pageItem.type === "ellipsis"}
                <Pagination.Item><Pagination.Ellipsis /></Pagination.Item>
              {:else}
                <Pagination.Item>
                  <Pagination.Link
                    page={pageItem}
                    isActive={currentPage === pageItem.value}
                  />
                </Pagination.Item>
              {/if}
            {/each}
            <Pagination.Item>
              <Pagination.Next />
            </Pagination.Item>
          </Pagination.Content>
        {/snippet}
      </Pagination.Root>
      <output class="text-sm text-muted-foreground">Page {page}</output>
    </div>
  {/snippet}
</Story>
