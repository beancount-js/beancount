<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import IngestionTable from "./IngestionTable.svelte";

  const { Story } = defineMeta({
    title: "Fava/Data Display/Ingestion Review",
    component: IngestionTable,
    parameters: {
      docs: {
        description: {
          component:
            "Fava's local ingestion-review table. It groups import proposals by date, separates records that need review from records ready to accept, supports bulk selection, and opens the review workflow from a row. It remains an application component: reuse the shared form and table primitives for new cross-application patterns rather than copying this workflow.",
        },
      },
    },
  });
</script>

<script lang="ts">
  import { onDestroy, setContext } from "svelte";
  import type { ProjectSnapshot } from "@beancount-js/workspace";
  import type {
    IngestionConfigResponse,
    IngestionRun,
    IngestionRunPage,
  } from "../ingestion/types";
  import { ContextKey, createContext } from "../context";
  import { LedgerSource } from "../core/ledger";
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
        contents: `option "operating_currency" "GBP"
2026-01-01 open Assets:Cash GBP
2026-01-01 open Liabilities:Northstar:Card GBP
2026-01-01 open Expenses:Groceries GBP
2026-01-01 open Expenses:Dining GBP`,
      },
    ],
    resources: [],
    revisions: [],
    issues: [],
    envKeys: [],
  } satisfies ProjectSnapshot;

  const config = {
    version: 3,
    sources: [
      {
        id: "northstar-card",
        name: "Northstar Card",
        kind: "json-api",
        sourceAccount: "Liabilities:Northstar:Card",
        defaultCurrency: "GBP",
        rules: [],
        credentialAvailable: true,
        allowedAccounts: ["Expenses:Groceries", "Expenses:Dining"],
      },
    ],
    accounts: ["Expenses:Groceries", "Expenses:Dining"],
  } satisfies IngestionConfigResponse;

  const run = {
    id: "northstar-july",
    sourceId: "northstar-card",
    startedAt: "2026-07-18T08:00:00.000Z",
    completedAt: "2026-07-18T08:01:00.000Z",
    proposals: [
      {
        id: "grocerly-42",
        importId: "northstar:grocerly-42",
        transaction: {
          sourceId: "northstar-card",
          sourceAccount: "Liabilities:Northstar:Card",
          bookedAt: "2026-07-18",
          amount: "-42.17",
          currency: "GBP",
          merchant: "Grocerly",
          narration: "Food and household shopping",
          status: "posted",
          fetchedAt: "2026-07-18T08:00:00.000Z",
          metadata: {},
        },
        selectedAccount: "Expenses:Groceries",
        status: "ready",
        suggestions: [
          {
            account: "Expenses:Groceries",
            method: "manual",
            explanation: "Matched Grocerly's saved category.",
            evidence: [],
            hard: true,
          },
        ],
        issues: [],
      },
      {
        id: "northstar-cafe-15",
        importId: "northstar:cafe-15",
        transaction: {
          sourceId: "northstar-card",
          sourceAccount: "Liabilities:Northstar:Card",
          bookedAt: "2026-07-18",
          amount: "-15.50",
          currency: "GBP",
          merchant: "Northstar Cafe",
          narration: "Lunch near the office",
          status: "posted",
          fetchedAt: "2026-07-18T08:00:00.000Z",
          metadata: {},
        },
        selectedAccount: "Expenses:Dining",
        status: "needs-review",
        suggestions: [
          {
            account: "Expenses:Dining",
            method: "manual",
            explanation: "A suggested category still needs confirmation.",
            evidence: [],
          },
        ],
        issues: [],
      },
    ],
    summary: {
      total: 2,
      ready: 1,
      needsReview: 1,
      accepted: 0,
      duplicates: 0,
      invalid: 0,
      held: 0,
      excluded: 0,
    },
  } satisfies IngestionRun;

  const runs = {
    runs: [
      {
        id: run.id,
        sourceId: run.sourceId,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        reviewState: "pending",
        summary: run.summary,
        updatedAt: run.completedAt,
      },
    ],
    total: 1,
    offset: 0,
    limit: 100,
  } satisfies IngestionRunPage;

  const source = new LedgerSource(snapshot.ledgerFiles[0].contents, {
    logTimings: undefined,
  });
  const context = createContext();
  context.ledgerSource.set(source);
  setContext(ContextKey, context);

  const navigation = createRouter(
    [{ path: "/import", element: IngestionTable }],
    "/import",
  );
  setContext(RouterKey, navigation);

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
    projectId: snapshot.project.id,
    ledgerPath: snapshot.project.entryFile,
    ledgerStem: "personal",
    availableLedgers: [snapshot.project.entryFile],
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url,
      "http://localhost",
    );
    const path = url.pathname;

    if (path.endsWith("/ingestion")) {
      return Response.json(config);
    }
    if (path.endsWith("/ingestion/runs")) {
      return Response.json(runs);
    }
    if (path.endsWith(`/ingestion/runs/${run.id}`)) {
      return Response.json(run);
    }
    if (path.endsWith("/ingestion/reconciliation")) {
      return Response.json({ count: 0 });
    }

    return originalFetch(input, init);
  };

  onDestroy(() => {
    globalThis.fetch = originalFetch;
    navigation.destroy?.();
  });
</script>

<Story
  name="Reviews grouped import proposals"
  play={async ({ canvas }) => {
    const cafe = await canvas.findByRole("checkbox", {
      name: "Select Northstar Cafe",
    });
    await userEvent.click(cafe);
    await expect(cafe).toBeChecked();

    const [disclosure] = canvas.getAllByRole("button", {
      name: "Collapse JULY 18, 2026",
    });
    await userEvent.click(disclosure);
    await expect(canvas.queryByText("Northstar Cafe")).not.toBeInTheDocument();

    const [expand] = canvas.getAllByRole("button", {
      name: "Expand JULY 18, 2026",
    });
    await userEvent.click(expand);
    await expect(canvas.getByText("Northstar Cafe")).toBeVisible();
  }}
>
  {#snippet template()}
    <div
      class="h-[48rem] max-w-6xl overflow-hidden rounded-xl border bg-background shadow-sm"
    >
      <IngestionTable />
    </div>
  {/snippet}
</Story>
