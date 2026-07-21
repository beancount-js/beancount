<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import SearchFilterBar from "./SearchFilterBar.svelte";
  import type { SearchFilterSyntax } from "./search-filter-syntax";

  const { Story } = defineMeta({
    title: "UI Forms/Search Filter Bar",
    component: SearchFilterBar,
    parameters: {
      docs: {
        description: {
          component:
            "The Beancount-aware search and filter composition used by application lists. It owns filter-query editing, clear actions, optional filter slots, and opt-in field/operator/value autocomplete with an inline syntax guide. Hosts supply the domain-specific filter syntax; it is a domain component rather than a general form field. See the [Form guidance](?path=/docs/ui-forms-guidance--docs).",
        },
      },
    },
  });
</script>

<script lang="ts">
  let query = $state("");
  let filtersExpanded = $state(false);
  let accountFilter = $state("All accounts");
  let syntaxQuery = $state("");
  let syntaxFiltersExpanded = $state(false);

  const merchantFilterSyntax: SearchFilterSyntax = {
    description:
      "Use a field, an operator, and a value to narrow merchant review.",
    fields: [
      {
        name: "confidence",
        description: "Best AI candidate score.",
        operators: [">", ">=", "<", "<=", "=", "!="],
      },
      {
        name: "status",
        description: "Merchant resolution state.",
        operators: [":", "=", "!="],
        values: ["confirmed", "suggested", "unresolved"],
      },
    ],
    examples: [
      {
        query: "confidence >= 0.9",
        description: "High-confidence suggestions.",
      },
      { query: "status: unresolved", description: "Needs review." },
    ],
    notes: ["Separate terms with a space to require both."],
  };
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
        onValueChange={(value) => {
          query = value;
        }}
        onClearSearch={() => {
          query = "";
        }}
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

<Story
  name="Discovers filter fields and syntax"
  play={async ({ canvas }) => {
    const editor = canvas.getByRole("searchbox", { name: "Search merchants" });
    await userEvent.click(editor);
    await userEvent.type(editor, "stat");
    await expect(canvas.getByRole("option", { name: /status/i })).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("option", { name: ": matches" }),
    ).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("option", { name: /confirmed/i }),
    ).toBeVisible();
    await expect(
      canvas.getByTestId("search-filter-autocomplete-values"),
    ).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: "Expand filter options" }),
    );
    const syntaxGuide = canvas.getByText("Search syntax", { exact: true });
    await expect(syntaxGuide).toBeVisible();
    await userEvent.click(syntaxGuide);
    await expect(canvas.getByText("Best AI candidate score.")).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="flex max-w-2xl flex-col gap-3">
      <SearchFilterBar
        value={syntaxQuery}
        ariaLabel="Search merchants"
        placeholder="Search merchants…"
        showFilterToggle
        bind:filtersExpanded={syntaxFiltersExpanded}
        filterSyntax={merchantFilterSyntax}
        onValueChange={(value) => {
          syntaxQuery = value;
        }}
        onClearSearch={() => {
          syntaxQuery = "";
        }}
      >
        {#snippet filters()}
          <div class="flex flex-wrap gap-2">
            <button type="button">Status</button>
          </div>
        {/snippet}
      </SearchFilterBar>
      <output class="text-sm text-muted-foreground">
        Query: {syntaxQuery || "none"}
      </output>
    </div>
  {/snippet}
</Story>
