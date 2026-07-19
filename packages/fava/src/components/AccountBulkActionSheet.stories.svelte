<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, screen, userEvent } from "storybook/test";
  import AccountBulkActionSheet from "./AccountBulkActionSheet.svelte";

  const { Story } = defineMeta({
    title: "Fava/Forms/Account Bulk Action Sheet",
    component: AccountBulkActionSheet,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's selected-record bulk-action sheet. It keeps account replacement and duplicate removal in separate, title-toggleable form sections; use it through the journal or account-activity header actions rather than creating another bulk-edit form.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { Transaction } from "@beancount-js/beancount";
  import { Button } from "$lib/components/ui/button";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import { journalRecords } from "./journal-table/model";
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

  const workspace = createStudioWorkspace(
    async () => {},
    async () => ({}) as never,
    async () => null,
    async () => ({ url: "", mimeType: "text/plain" }),
    () => {},
  );
  setStudioWorkspace(workspace);

  const records = journalRecords(
    source.directives.filter((directive) => directive instanceof Transaction),
  );
  let open = $state(false);
</script>

<Story
  name="Opens and collapses selected-record actions"
  play={async ({ canvas }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Bulk actions" }));
    await expect(
      screen.getByRole("dialog", { name: "Bulk actions" }),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    await expect(
      screen.getByRole("button", { name: "Expand all" }),
    ).toBeVisible();
    await expect(canvas.getByRole("status")).toHaveTextContent("open");
  }}
>
  {#snippet template()}
    <Tooltip.Provider delayDuration={0}>
      <Button type="button" onclick={() => (open = true)}>Bulk actions</Button>
      <AccountBulkActionSheet bind:open {records} />
    </Tooltip.Provider>
    <output class="sr-only" aria-live="polite">
      Bulk actions are {open ? "open" : "closed"}.
    </output>
  {/snippet}
</Story>
