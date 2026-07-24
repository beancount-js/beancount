<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import QueryTable from "./QueryTable.svelte";

  const { Story } = defineMeta({
    title: "Fava/Data Display/Query Table",
    component: QueryTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's BQL result table. It formats ledger-aware result types, supports accessible column sorting, derives a chart where the result shape allows it, and reports query failures in context.",
        },
      },
    },
  });

  const postingsPerAccount = `
    SELECT account, count(account)
    FROM postings
    GROUP BY account
  `;
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import {
    createStudioWorkspace,
    setStudioWorkspace,
  } from "../studio/workspace";

  const context = createContext();
  context.ledgerSource.set(
    new LedgerSource(
      `
        option "operating_currency" "GBP"
        2026-01-01 open Assets:Cash GBP
        2026-01-01 open Expenses:Groceries GBP
        2026-07-18 * "Groceries"
          Expenses:Groceries  42.17 GBP
          Assets:Cash        -42.17 GBP
      `,
      { logTimings: undefined },
    ),
  );
  setContext(ContextKey, context);

  const workspace = createStudioWorkspace(
    async () => {},
    async () => ({}) as never,
    async () => null,
    async () => ({ url: "", mimeType: "text/plain" }),
    () => {},
  );
  setStudioWorkspace(workspace);
</script>

<Story
  name="Sorts ledger query results"
  play={async ({ canvas }) => {
    const accountSort = canvas.getByRole("button", {
      name: "Sort by account",
    });
    await userEvent.click(accountSort);
    await expect(
      canvas.getByRole("columnheader", { name: "account" }),
    ).toHaveAttribute("aria-sort", "ascending");
  }}
>
  {#snippet template()}
    <div class="max-w-3xl">
      <QueryTable query={postingsPerAccount} />
    </div>
  {/snippet}
</Story>

<Story name="Explains an invalid query">
  {#snippet template()}
    <div class="max-w-3xl">
      <QueryTable query="SELECT missing FROM" />
    </div>
  {/snippet}
</Story>
