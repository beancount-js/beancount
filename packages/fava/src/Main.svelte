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
  import IngestionTable from "./components/IngestionTable.svelte";
  import IngestionConfigEditor from "./components/IngestionConfigEditor.svelte";
  import IngestionAccountsSetup from "./components/IngestionAccountsSetup.svelte";
  import IngestionMerchantReview from "./components/IngestionMerchantReview.svelte";
  import IngestionMerchantManage from "./components/IngestionMerchantManage.svelte";
  import IngestionBrandSettings from "./components/IngestionBrandSettings.svelte";
  import IngestionRunHistory from "./components/IngestionRunHistory.svelte";
  import IngestionRunAudit from "./components/IngestionRunAudit.svelte";
  import RulesSettings from "./components/RulesSettings.svelte";
  import FavaNavigation from "./components/FavaNavigation.svelte";
  import Search from "./components/Search.svelte";
  import JournalRecordRouteSheet from "./components/JournalRecordRouteSheet.svelte";
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
  import type { IngestionReviewLedgerSnapshot } from "./ingestion/types";
  import { hashUrlToLedgerHref, ledgerStemForPath } from "./lib/ledger-route";
  import { setStudioRouteEnv } from "./lib/studio-route-env";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
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
    expectedRevision?: string,
  ) => Promise<ProjectSnapshot>;
  export let onRefreshProject: () => Promise<ProjectSnapshot>;
  export let onRefreshReviewLedger: () => Promise<IngestionReviewLedgerSnapshot | null> =
    async () => null;
  export let onResourceUrl: (
    path: string,
  ) => Promise<{ url: string; mimeType: string; revoke?: () => void }>;
  /** Canonical ledger path from the URL (with extension). */
  export let routeLedgerPath: string | undefined = undefined;
  export let reviewLedger: IngestionReviewLedgerSnapshot | null = null;

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
      { path: "/records", element: IngestionTable },
      { path: "/import/editor", element: IngestionConfigEditor },
      { path: "/import/accounts", element: IngestionAccountsSetup },
      { path: "/import/merchants", element: IngestionMerchantReview },
      { path: "/import/manage-merchants", element: IngestionMerchantManage },
      { path: "/import/brands", element: IngestionBrandSettings },
      { path: "/import/history/:runId", element: IngestionRunAudit },
      { path: "/import/history", element: IngestionRunHistory },
      { path: "/import/rules", element: RulesSettings },
      { path: "/directives", element: Editor },
      { path: "/resource", element: ResourceViewer },
    ],
    "/dashboard",
  );
  let inlineAiRequest: InlineAiRequest | undefined;
  const workspace = createStudioWorkspace(
    saveFile,
    refreshSnapshot,
    refreshReviewLedger,
    onResourceUrl,
    (request) => {
      inlineAiRequest = request;
    },
  );
  const { activeFile, activeLedgerKind } = workspace;
  const { activeRoute, router, routerLink } = navigation;
  const utilityPageTitles: Record<string, string> = {
    "/errors": "Errors",
    "/records": "Records",
    "/import/editor": "Sources",
    "/import/accounts": "Accounts",
    "/import/merchants": "Review merchants",
    "/import/manage-merchants": "Manage merchants",
    "/import/brands": "Brand match",
    "/import/history": "Import history",
    "/import/rules": "Rules",
    "/directives": "Editor",
    "/resource": "Resource",
    "/404": "Page not found",
  };
  let loadedSignature = "";
  let loadedLedgerSignature = "";
  let activeLedgerPath = "";
  let pageTitle = "Beancount Studio";

  context.menu.set([MainNav]);
  setContext(ContextKey, context);
  setContext(RouterKey, navigation);
  setStudioWorkspace(workspace);

  async function refreshReviewLedger() {
    const next = await onRefreshReviewLedger();
    workspace.reviewLedger.set(next);
    return next;
  }

  function availableLedgerPaths(next: ProjectSnapshot) {
    return [
      ...next.ledgerFiles.map((file) => file.path),
      ...(reviewLedger ? [reviewLedger.path] : []),
    ];
  }

  function syncRouteEnv(next: ProjectSnapshot, ledgerPath: string) {
    const available = availableLedgerPaths(next);
    setStudioRouteEnv({
      projectId: next.project.id,
      ledgerPath,
      ledgerStem: ledgerStemForPath(ledgerPath, available),
      availableLedgers: available,
    });
  }

  function applySnapshot(next: ProjectSnapshot) {
    workspace.snapshot.set(next);
    const available = availableLedgerPaths(next);
    const selected =
      (routeLedgerPath && available.includes(routeLedgerPath)
        ? routeLedgerPath
        : undefined) ??
      (available.includes($activeFile) ? $activeFile : undefined) ??
      next.project.entryFile;
    workspace.activeFile.set(selected);
    loadLedger(next, selected);
    syncRouteEnv(next, selected);
  }

  onMount(() => {
    // Legacy hash bookmarks → path URLs
    if (typeof window === "undefined" || !snapshot) return;
    const hash = window.location.hash;
    if (!hash || hash === "#") return;
    const available = availableLedgerPaths(snapshot);
    const href = hashUrlToLedgerHref(
      snapshot.project.id,
      hash,
      available,
      snapshot.project.entryFile,
    );
    if (href) {
      void goto(href, { replaceState: true });
    }
  });

  function loadLedger(next: ProjectSnapshot, entryFile: string) {
    const virtual = entryFile === reviewLedger?.path ? reviewLedger : undefined;
    const signature = `${next.project.id}:${entryFile}:${
      virtual?.revision ?? next.revisions.map((item) => item.revision).join(":")
    }`;
    if (signature === loadedLedgerSignature) return;

    loadedLedgerSignature = signature;
    context.ledgerSource.set(
      LedgerSource.fromProject(
        entryFile,
        virtual
          ? [{ path: virtual.path, contents: virtual.contents }]
          : next.ledgerFiles.map((file) => ({
              path: file.path,
              contents: file.contents,
            })),
      ),
    );
  }

  async function saveFile(
    path: string,
    contents: string,
    expectedRevision?: string,
  ) {
    const next = await onSaveFile(path, contents, expectedRevision);
    applySnapshot(next);
  }

  async function refreshSnapshot() {
    const next = await onRefreshProject();
    applySnapshot(next);
    return next;
  }

  function titleForRoute(
    path: string,
    params: Record<string, string | undefined>,
  ) {
    if (path === "/editor" || path === "/directives") {
      const filePath = $activeFile?.trim();
      if (filePath) {
        const slash = filePath.lastIndexOf("/");
        return slash >= 0 ? filePath.slice(slash + 1) : filePath;
      }
      return "Editor";
    }

    const mainTab = MainNav.find((item) => item.path === path);
    if (mainTab) return mainTab.name;

    if (path === "/") return "Balance Sheet";
    if (path === "/accounts") return "Accounts";
    if (path.startsWith("/account/")) {
      return params.account ? `Account: ${params.account}` : "Account";
    }
    if (path.startsWith("/import/history/")) return "Import run";

    return utilityPageTitles[path] ?? "Beancount Studio";
  }

  $: pageTitle = titleForRoute($activeRoute.path, $activeRoute.params);

  $: workspace.reviewLedger.set(reviewLedger);

  $: if (snapshot) {
    const signature = `${snapshot.project.id}:${snapshot.revisions.map((item) => item.revision).join(":")}`;
    if (signature !== loadedSignature) {
      loadedSignature = signature;
      applySnapshot(snapshot);
    }
  } else {
    workspace.snapshot.set(undefined);
  }

  $: activeLedgerPath =
    snapshot && availableLedgerPaths(snapshot).includes($activeFile)
      ? $activeFile
      : (snapshot?.project.entryFile ?? "");

  $: activeLedgerKind.set(
    reviewLedger?.path === activeLedgerPath ? "ingestion-review" : "file",
  );

  $: context.menu.set([
    $activeLedgerKind === "ingestion-review"
      ? MainNav.filter((item) => item.path !== "/editor")
      : MainNav,
  ]);

  $: if (snapshot && activeLedgerPath) {
    loadLedger(snapshot, activeLedgerPath);
    syncRouteEnv(snapshot, activeLedgerPath);
  }

  $: if (snapshot && routeLedgerPath && routeLedgerPath !== $activeFile) {
    if (availableLedgerPaths(snapshot).includes(routeLedgerPath)) {
      workspace.activeFile.set(routeLedgerPath);
    }
  }

  $: if (
    snapshot &&
    !reviewLedger &&
    $activeFile === ".beancount/ingestion/active-review.beancount"
  ) {
    workspace.activeFile.set(snapshot.project.entryFile);
    router.push("/records");
  }

  $: if (
    $activeLedgerKind === "ingestion-review" &&
    ($activeRoute.path === "/editor" || $activeRoute.path === "/directives")
  ) {
    router.push("/journal");
  }
</script>

<Tooltip.Provider delayDuration={0} ignoreNonKeyboardFocus>
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
    <JournalRecordRouteSheet />
    <svelte:fragment slot="ai">
      <AiDock
        projectId={snapshot?.project.id}
        projectName={snapshot?.project.name ?? "Ledger"}
        hasProject={Boolean(snapshot)}
        {isWeb}
        inlineRequest={inlineAiRequest}
        onProjectChanged={async () => {
          await onRefreshProject();
        }}
      />
    </svelte:fragment>
  </StudioShell>
</Tooltip.Provider>
