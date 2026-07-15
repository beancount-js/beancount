<script lang="ts">
  import { setContext } from "svelte";
  import type {
    ProjectSnapshot,
    ProjectSummary,
  } from "@beancount-js/workspace";
  import { ContextKey, createContext } from "./context";
  import { createRouter, RouterKey } from "./router/router";
  import { MainNav } from "./menu";
  import { LedgerSource } from "./core/ledger";
  import Editor from "./components/Editor.svelte";
  import Errors from "./components/errors/Errors.svelte";
  import JournalTable from "./components/JournalTable.svelte";
  import FinancialDashboard from "./components/FinancialDashboard.svelte";
  import IncomeStatement from "./components/IncomeStatement.svelte";
  import BalanceSheet from "./components/BalanceSheet.svelte";
  import TrialBalance from "./components/TrialBalance.svelte";
  import Holdings from "./components/Holdings.svelte";
  import Statistics from "./components/Statistics.svelte";
  import Query from "./components/Query.svelte";
  import AccountDetails from "./components/AccountDetails.svelte";
  import ImportTable from "./components/ImportTable.svelte";
  import ImportEditor from "./components/ImportEditor.svelte";
  import FavaNavigation from "./components/FavaNavigation.svelte";
  import Search from "./components/Search.svelte";
  import StudioShell from "./components/StudioShell.svelte";
  import AiDock from "./components/AiDock.svelte";
  import ResourceViewer from "./components/ResourceViewer.svelte";
  import View from "./router/View.svelte";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import {
    createStudioWorkspace,
    setStudioWorkspace,
    type InlineAiRequest,
  } from "./studio/workspace";
  import "@fontsource/source-code-pro/400.css";
  import "@fontsource/source-code-pro/600.css";
  import "./codemirror/themes/base.scss";

  export let snapshot: ProjectSnapshot | undefined;
  export let projects: ProjectSummary[] = [];
  export let isWeb = false;
  export let status = "";
  export let onSelectProject: (id: string) => Promise<void>;
  export let onAddProject: (path?: string) => Promise<void>;
  export let onSaveFile: (
    path: string,
    contents: string,
  ) => Promise<ProjectSnapshot>;
  export let onAskAi: (
    question: string,
    context?: InlineAiRequest,
    model?: string,
  ) => Promise<string>;
  export let onResourceUrl: (
    path: string,
  ) => Promise<{ url: string; mimeType: string; revoke?: () => void }>;

  const context = createContext();
  const navigation = createRouter(
    [
      { path: "/", element: BalanceSheet },
      { path: "/dashboard", element: FinancialDashboard },
      { path: "/income_statement", element: IncomeStatement },
      { path: "/balance_sheet", element: BalanceSheet },
      { path: "/trial_balance", element: TrialBalance },
      { path: "/journal", element: JournalTable },
      { path: "/errors", element: Errors },
      { path: "/accounts", element: AccountDetails },
      { path: "/account/:account", element: AccountDetails },
      { path: "/holdings", element: Holdings },
      { path: "/query", element: Query },
      { path: "/editor", element: Editor },
      { path: "/statistics", element: Statistics },
      { path: "/records", element: ImportTable },
      { path: "/import/editor", element: ImportEditor },
      { path: "/directives", element: Editor },
      { path: "/resource", element: ResourceViewer },
    ],
    "/journal",
  );
  let inlineAiRequest: InlineAiRequest | undefined;
  const workspace = createStudioWorkspace(
    saveFile,
    onResourceUrl,
    (request) => {
      inlineAiRequest = request;
    },
  );
  const { activeFile } = workspace;
  const { activeRoute, routerLink } = navigation;
  const utilityPageTitles: Record<string, string> = {
    "/errors": "Errors",
    "/records": "Import",
    "/import/editor": "Import Editor",
    "/directives": "Editor",
    "/resource": "Resource",
    "/404": "Page not found",
  };
  let loadedSignature = "";
  let pageTitle = "Beancount Studio";

  context.menu.set([MainNav]);
  setContext(ContextKey, context);
  setContext(RouterKey, navigation);
  setStudioWorkspace(workspace);

  function applySnapshot(next: ProjectSnapshot) {
    workspace.snapshot.set(next);
    const selectedRouteLedger = $activeRoute.query["ledger"];
    const available = next.ledgerFiles.some(
      (file) => file.path === selectedRouteLedger,
    )
      ? selectedRouteLedger
      : next.ledgerFiles.some((file) => file.path === $activeFile)
        ? $activeFile
        : next.project.entryFile;
    workspace.activeFile.set(available);
    context.ledgerSource.set(
      LedgerSource.fromProject(
        next.project.entryFile,
        next.ledgerFiles.map((file) => ({
          path: file.path,
          contents: file.contents,
        })),
      ),
    );
  }

  async function saveFile(path: string, contents: string) {
    const next = await onSaveFile(path, contents);
    applySnapshot(next);
  }

  function titleForRoute(
    path: string,
    params: Record<string, string | undefined>,
  ) {
    const mainTab = MainNav.find((item) => item.path.slice(1) === path);
    if (mainTab) return mainTab.name;

    if (path === "/") return "Balance Sheet";
    if (path === "/accounts") return "Accounts";
    if (path.startsWith("/account/")) {
      return params.account ? `Account: ${params.account}` : "Account";
    }

    return utilityPageTitles[path] ?? "Beancount Studio";
  }

  $: pageTitle = titleForRoute($activeRoute.path, $activeRoute.params);

  $: if (snapshot) {
    const signature = `${snapshot.project.id}:${snapshot.revisions.map((item) => item.revision).join(":")}`;
    if (signature !== loadedSignature) {
      loadedSignature = signature;
      applySnapshot(snapshot);
    }
  } else {
    workspace.snapshot.set(undefined);
  }
</script>

<Tooltip.Provider delayDuration={0}>
  <StudioShell
    {projects}
    {snapshot}
    {isWeb}
    {status}
    {pageTitle}
    {onSelectProject}
    {onAddProject}
  >
    <svelte:fragment slot="workspace"><FavaNavigation /></svelte:fragment>
    <svelte:fragment slot="search"><Search /></svelte:fragment>
    <div class="h-full min-w-0 overflow-hidden" use:routerLink>
      <View />
    </div>
    <svelte:fragment slot="ai">
      <AiDock
        projectName={snapshot?.project.name ?? "Ledger"}
        hasProject={Boolean(snapshot)}
        {isWeb}
        inlineRequest={inlineAiRequest}
        onAsk={onAskAi}
      />
    </svelte:fragment>
  </StudioShell>
</Tooltip.Provider>
