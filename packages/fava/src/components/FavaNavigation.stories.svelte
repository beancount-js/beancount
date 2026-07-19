<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import FavaNavigation from "./FavaNavigation.svelte";

  const { Story } = defineMeta({
    title: "Fava/Navigation/Ledger Navigation",
    component: FavaNavigation,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's ledger-aware sidebar. It provides the file, folder, and tag views plus the per-ledger page navigation; use it through the Studio shell rather than recreating a parallel page navigator.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { setContext } from "svelte";
  import type { ProjectSnapshot } from "@beancount-js/workspace";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
  import { MainNav } from "../menu";
  import { RouterKey, createRouter } from "../router/router";
  import { setStudioRouteEnv } from "../lib/studio-route-env";
  import {
    createStudioWorkspace,
    setStudioWorkspace,
  } from "../studio/workspace";

  const snapshot = {
    project: {
      id: "northstar-ledger",
      name: "Northstar Ledger",
      entryFile: "ledgers/personal.beancount",
      updatedAt: "2026-07-19T09:00:00.000Z",
      createdAt: "2026-07-01T09:00:00.000Z",
      version: 1,
    },
    ledgerFiles: [
      {
        path: "ledgers/personal.beancount",
        contents: `option "title" "Northstar Ledger"
2026-01-01 open Assets:Cash
2026-01-01 open Expenses:Groceries
2026-07-18 * "Groceries" #home
  Expenses:Groceries  42.17 GBP
  Assets:Cash`,
      },
      {
        path: "ledgers/shared.beancount",
        contents: `2026-01-01 open Assets:Bank
2026-01-01 open Expenses:Travel`,
      },
    ],
    resources: [
      { path: "receipts/groceries.pdf", mimeType: "application/pdf", size: 42 },
    ],
    revisions: [],
    issues: [],
    envKeys: [],
  } satisfies ProjectSnapshot;

  const context = createContext();
  context.menu.set([MainNav]);
  context.ledgerSource.set(new LedgerSource(snapshot.ledgerFiles[0].contents));
  setContext(ContextKey, context);

  const navigation = createRouter(
    [
      { path: "/dashboard", element: FavaNavigation },
      { path: "/journal", element: FavaNavigation },
      { path: "/account/:account", element: FavaNavigation },
      { path: "/accounts", element: FavaNavigation },
      { path: "/query", element: FavaNavigation },
      { path: "/resource", element: FavaNavigation },
    ],
    "/dashboard",
  );
  setContext(RouterKey, navigation);
  const { activeRoute } = navigation;

  const workspace = createStudioWorkspace(
    async () => {},
    async () => snapshot,
    async () => null,
    async () => ({ url: "", mimeType: "text/plain" }),
    () => {},
  );
  workspace.snapshot.set(snapshot);
  workspace.activeFile.set(snapshot.project.entryFile);
  setStudioWorkspace(workspace);
  setStudioRouteEnv({
    projectId: "",
    ledgerPath: "",
    ledgerStem: "",
    availableLedgers: [],
  });
</script>

<Story
  name="Navigates a selected ledger"
  play={async ({ canvas }) => {
    const journal = canvas.getByRole("button", { name: "Journal" });
    await userEvent.click(journal);
    await expect(journal).toHaveAttribute("aria-current", "page");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Active route: /journal",
    );
  }}
>
  {#snippet template()}
    <aside
      class="flex h-[42rem] w-72 flex-col overflow-hidden rounded-xl border bg-sidebar p-3 text-sidebar-foreground shadow-sm"
      aria-label="Ledger navigation example"
    >
      <FavaNavigation />
    </aside>
    <output class="sr-only" aria-live="polite">
      Active route: {$activeRoute.path}
    </output>
  {/snippet}
</Story>
