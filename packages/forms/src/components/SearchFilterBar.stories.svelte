<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import SearchFilterBar from "./SearchFilterBar.svelte";

  const { Story } = defineMeta({
    title: "Forms/Search Filter Bar",
    component: SearchFilterBar,
    parameters: {
      docs: {
        description: {
          component:
            "The Beancount-aware search and filter composition used by application lists. It owns filter-query editing, clear actions, and optional filter slots; it is a retained domain component rather than a general form field.",
        },
      },
    },
  });
</script>

<script lang="ts">
  let query = $state("");
  let filtersExpanded = $state(false);
  let accountFilter = $state("All accounts");
</script>

<Story
  name="Filters a transaction list"
  play={async ({ canvas }) => {
    await userEvent.type(
      canvas.getByRole("searchbox", { name: "Search transactions" }),
      "groceries",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("groceries");
    await userEvent.click(
      canvas.getByRole("button", { name: "Expand filter options" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Expenses only" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="flex max-w-2xl flex-col gap-3">
      <SearchFilterBar
        value={query}
        inputMode="plain"
        ariaLabel="Search transactions"
        placeholder="Search payees and accounts"
        showFilterToggle
        bind:filtersExpanded
        onValueChange={(value) => (query = value)}
        onClearSearch={() => (query = "")}
      >
        {#snippet filters()}
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={accountFilter === "Expenses"}
              onclick={() => (accountFilter = "Expenses")}
            >
              Expenses only
            </button>
            <button
              type="button"
              aria-pressed={accountFilter === "All accounts"}
              onclick={() => (accountFilter = "All accounts")}
            >
              All accounts
            </button>
          </div>
        {/snippet}
      </SearchFilterBar>
      <output class="text-sm text-muted-foreground">
        Query: {query || "none"}; account: {accountFilter}
      </output>
    </div>
  {/snippet}
</Story>
