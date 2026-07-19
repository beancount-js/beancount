<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import ImportTable from "./ImportTable.svelte";

  const { Story } = defineMeta({
    title: "Fava/Data Display/Import Table",
    component: ImportTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local import-review surface. It groups imported rows by their account classification, keeps account suggestions editable, and retains the original drop-zone workflow for switching or adding files.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import { ImportAccount, ImportConfig, ImportPattern } from "../import/models";
  import { importerStore } from "../import/store";

  const source = new LedgerSource(
    `
      option "operating_currency" "GBP"
      2026-01-01 open Assets:Cash GBP
      2026-01-01 open Expenses:Groceries GBP
      2026-01-01 open Expenses:Uncategorized GBP
    `,
    { logTimings: undefined },
  );
  const context = createContext();
  context.ledgerSource.set(source);
  context.importConfig.set(
    new ImportConfig(
      "Northstar CSV",
      "1.0",
      "dd/MM/yyyy",
      [
        { id: "date", name: "Date", required: true, type: "date" },
        {
          id: "description",
          name: "Description",
          required: true,
          type: "narration",
        },
        { id: "amount", name: "Amount", required: true, type: "amount" },
      ],
      {},
      [
        new ImportAccount(
          "Assets:Cash",
          [new ImportPattern(/^.*$/gm, 1, 0)],
          "GBP",
          {
            "Expenses:Groceries": [
              new ImportPattern(
                /description:.*groceries.*/gim,
                1,
                "Expenses:Groceries",
              ),
            ],
          },
        ),
      ],
    ),
  );

  const importFile = {
    filename: "northstar-july.csv",
    data: [
      {
        data: {
          date: "18/07/2026",
          description: "Groceries",
          amount: "42.17",
        },
        account: "",
        source: `2026-07-18 * "Groceries"
  Assets:Cash  -42.17 GBP
  Expenses:Groceries`,
      },
    ],
  };
  context.importFile.set(importFile);
  importerStore.set([importFile]);
  setContext(ContextKey, context);
</script>

<Story
  name="Switches between reviewed rows and import workflow"
  play={async ({ canvas }) => {
    await expect(canvas.getByText("northstar-july.csv")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Import" }));
    await expect(canvas.getByText("Click to upload")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Categorized" }));
    await expect(canvas.getByRole("button", { name: "Reset" })).toBeVisible();
  }}
>
  {#snippet template()}
    <div
      class="h-[40rem] max-w-6xl overflow-hidden rounded-xl border bg-background p-3 shadow-sm"
    >
      <ImportTable />
    </div>
  {/snippet}
</Story>
