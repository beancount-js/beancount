<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, screen, userEvent } from "storybook/test";
  import JournalTable from "./JournalTable.svelte";

  const { Story } = defineMeta({
    title: "Fava/Data Display/Journal Table",
    component: JournalTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's journal-page table. It composes the grouped activity view with the workspace-header bulk-action contract; pages should use this component instead of reimplementing selection and account-replacement wiring.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { Button } from "@beancount-js/ui/shadcn/button";
  import * as Tooltip from "@beancount-js/ui/shadcn/tooltip";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import { RouterKey, createRouter } from "../router/router";
  import { ingestionHeaderActions } from "../studio/ingestion-header-actions";
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
    [{ path: "/journal", element: JournalTable }],
    "/journal",
  );
  setContext(RouterKey, navigation);

  const workspace = createStudioWorkspace(
    async () => {},
    async () => ({}) as never,
    async () => null,
    async () => ({ url: "", mimeType: "text/plain" }),
    () => {},
  );
  setStudioWorkspace(workspace);

  $: selectedCount =
    $ingestionHeaderActions?.kind === "account-activity"
      ? $ingestionHeaderActions.selectedCount
      : 0;
  $: replaceAccounts =
    $ingestionHeaderActions?.kind === "account-activity"
      ? $ingestionHeaderActions.onReplace
      : undefined;
</script>

<Story
  name="Selects journal records for account replacement"
  play={async ({ canvas }) => {
    await userEvent.click(
      canvas.getByRole("checkbox", { name: "Select Groceries" }),
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "1 selected record",
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "Replace accounts (1)" }),
    );
    await expect(
      screen.getByRole("dialog", { name: "Bulk actions" }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <Tooltip.Provider delayDuration={0}>
      <div
        class="flex h-[42rem] max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-sm"
      >
        <div
          class="flex items-center justify-between border-b bg-muted/30 px-3 py-2"
        >
          <span class="text-sm font-medium">Journal toolbar</span>
          <Button
            type="button"
            size="sm"
            disabled={!replaceAccounts || selectedCount === 0}
            onclick={() => replaceAccounts?.()}
          >
            Replace accounts ({selectedCount})
          </Button>
        </div>
        <div class="min-h-0 flex-1">
          <JournalTable />
        </div>
      </div>
    </Tooltip.Provider>
    <output class="sr-only" aria-live="polite">
      {selectedCount} selected {selectedCount === 1 ? "record" : "records"}
    </output>
  {/snippet}
</Story>
