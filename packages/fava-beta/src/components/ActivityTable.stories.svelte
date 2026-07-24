<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import ActivityTable from "./ActivityTable.svelte";

  const { Story } = defineMeta({
    title: "Fava/Data Display/Activity Table",
    component: ActivityTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's reusable grouped-ledger activity view. It is the interaction layer shared by journal-style screens: group disclosure, date-balance context, timeframe selection, record opening, and controlled bulk selection.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { DEFAULT_CONVERSION } from "@beancount-js/beancount";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import { RouterKey, createRouter } from "../router/router";
  import {
    createStudioWorkspace,
    setStudioWorkspace,
  } from "../studio/workspace";

  const source = new LedgerSource(
    `
      option "operating_currency" "GBP"
      2026-01-01 open Assets:Cash GBP
      2026-01-01 open Expenses:Groceries GBP
      2026-07-18 * "Groceries"
        Expenses:Groceries  42.17 GBP
        Assets:Cash        -42.17 GBP
    `,
    { logTimings: undefined },
  );
  const context = createContext();
  context.ledgerSource.set(source);
  setContext(ContextKey, context);

  const navigation = createRouter(
    [{ path: "/journal", element: ActivityTable }],
    "/journal",
  );
  const { activeRoute } = navigation;
  setContext(RouterKey, navigation);

  const workspace = createStudioWorkspace(
    async () => {},
    async () => ({}) as never,
    async () => null,
    async () => ({ url: "", mimeType: "text/plain" }),
    () => {},
  );
  setStudioWorkspace(workspace);

  const balancesByDate = source.data.accountBalanceByDate(
    DEFAULT_CONVERSION,
    "Assets",
    "Liabilities",
  );
  let selectedKeys = $state(new Set<string>());
</script>

<Story
  name="Selects records from a grouped journal"
  play={async ({ canvas }) => {
    const groceries = canvas.getByRole("checkbox", {
      name: "Select Groceries",
    });
    await userEvent.click(groceries);
    await expect(groceries).toBeChecked();
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "1 record selected",
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "Open Groceries" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent("record opened");
  }}
>
  {#snippet template()}
    <div
      class="h-[42rem] max-w-5xl overflow-hidden rounded-xl border bg-background shadow-sm"
    >
      <ActivityTable
        directives={source.directives}
        {balancesByDate}
        balanceRoots={["Assets", "Liabilities"]}
        bind:selectedKeys
        linkAccounts
      />
    </div>
    <output class="sr-only" aria-live="polite">
      {selectedKeys.size}
      {selectedKeys.size === 1 ? "record" : "records"}
      selected; {$activeRoute.query.record
        ? "record opened"
        : "no record opened"}
    </output>
  {/snippet}
</Story>

<Story name="Explains an empty journal filter">
  {#snippet template()}
    <div
      class="h-72 max-w-5xl overflow-hidden rounded-xl border bg-background shadow-sm"
    >
      <ActivityTable directives={[]} selectable={false} />
    </div>
  {/snippet}
</Story>
