<script lang="ts">
  import AiDock from "../../domain/components/AiDock.svelte";
  import IngestionTable from "../../domain/components/IngestionTable.svelte";
  import IngestionConfigEditor from "../../domain/components/IngestionConfigEditor.svelte";
  import IngestionAccountsSetup from "../../domain/components/IngestionAccountsSetup.svelte";
  import IngestionMerchantReview from "../../domain/components/IngestionMerchantReview.svelte";
  import IngestionMerchantManage from "../../domain/components/IngestionMerchantManage.svelte";
  import IngestionBrandSettings from "../../domain/components/IngestionBrandSettings.svelte";
  import IngestionRunHistory from "../../domain/components/IngestionRunHistory.svelte";
  import RulesSettings from "../../domain/components/RulesSettings.svelte";
  import IngestionRunAudit from "../../domain/components/IngestionRunAudit.svelte";
  import { BeancountControllerKey } from "../../controller/context";
  import JournalTable from "../../domain/components/JournalTable.svelte";
  import AccountDetails from "../../domain/components/AccountDetails.svelte";
  import Editor from "../../domain/components/Editor.svelte";
  import Query from "../../domain/components/Query.svelte";
  import Search from "../../domain/components/Search.svelte";
  import ResourceViewer from "../../domain/components/ResourceViewer.svelte";
  import JournalRecordRouteSheet from "../../domain/components/JournalRecordRouteSheet.svelte";
  import IngestionHeaderActions from "../../domain/components/IngestionHeaderActions.svelte";
  import { setContext, onMount, onDestroy, untrack } from "svelte";
  import {
    AppShellController,
    createLocalStorageAppShellLayoutPersistence,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import { FilterCommandPicker } from "@lapismd/design-core/forms";
  import { ContextKey } from "../../domain/context";
  import { ClockKey } from "../../domain/components/dashboard/clock";
  import IncomeStatement from "../../domain/components/IncomeStatement.svelte";
  import BalanceSheet from "../../domain/components/BalanceSheet.svelte";
  import TrialBalance from "../../domain/components/TrialBalance.svelte";
  import Holdings from "../../domain/components/Holdings.svelte";
  import Statistics from "../../domain/components/Statistics.svelte";
  import Errors from "../../domain/components/errors/Errors.svelte";
  import FinancialDashboard from "../../domain/components/FinancialDashboard.svelte";
  import BeancountAppShell from "../app-shell/BeancountAppShell.svelte";
  import type { BeancountController } from "../../controller";
  import {
    ledgerDestinations,
    settingsDestinations,
    routeTitle,
  } from "../../controller";
  let {
    controller,
    displayMode = "auto",
    layoutStorage,
  }: {
    controller: BeancountController;
    displayMode?: AppShellDisplayMode;
    layoutStorage?: Storage;
  } = $props();
  setContext(
    BeancountControllerKey,
    untrack(() => controller),
  );
  setContext(
    ContextKey,
    untrack(() => controller.presentation),
  );
  setContext(
    ClockKey,
    untrack(() => controller.clock),
  );
  const shell = untrack(
    () =>
      new AppShellController({
        leftWidth: 260,
        rightClosed: true,
        rightWidth: 320,
        ...(layoutStorage
          ? {
              persistence: createLocalStorageAppShellLayoutPersistence(
                "beancount-ui-shell",
                untrack(() => layoutStorage),
              ),
            }
          : {}),
      }),
  );
  onMount(() => {
    void controller.initialize().catch(() => {});
  });
  onDestroy(() => {
    void shell.dispose();
  });
  $effect(() => {
    if (controller.state.inlineAiRequest) {
      untrack(() => {
        shell.right.open();
        if (shell.mobile.resolvedMode === "mobile") shell.mobile.show("right");
      });
    }
  });
  function navigate(path: string) {
    controller.actions.navigate(path);
    shell.mobile.showMain();
  }
  function followLinks(event: MouseEvent) {
    const target = (event.target as Element)?.closest("a");
    const href = target?.getAttribute("href");
    if (href?.startsWith("/") && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      navigate(href);
    }
  }
  function routerLinks(node: HTMLElement) {
    node.addEventListener("click", followLinks);
    return {
      destroy() {
        node.removeEventListener("click", followLinks);
      },
    };
  }
</script>

<div
  class="beancount-application beancount"
  data-testid="beancount-application"
  data-status={controller.state.status}
>
  <Tooltip.Provider>
    <BeancountAppShell
      controller={shell}
      {displayMode}
      title={routeTitle(controller.state.route)}
      canNavigateBack={controller.state.canNavigateBack}
      canNavigateForward={controller.state.canNavigateForward}
      onBack={controller.actions.back}
      onForward={controller.actions.forward}
    >
      {#snippet navigation()}
        <div class="beancount-navigation">
          <FilterCommandPicker
            label="Project"
            ariaLabel="Project"
            fullWidth
            value={controller.state.snapshot?.project.id}
            options={controller.state.projects.map((project) => ({
              value: project.id,
              label: project.name,
            }))}
            onChange={controller.actions.selectProject}
          />
          <FilterCommandPicker
            label="Ledger"
            ariaLabel="Ledger"
            fullWidth
            value={controller.state.activeFile}
            options={(controller.state.snapshot?.ledgerFiles ?? []).map(
              (file) => ({ value: file.path, label: file.path }),
            )}
            onChange={controller.actions.selectFile}
          />
          <Search />
          <nav aria-label="Ledger reports">
            {#each [...ledgerDestinations, ...settingsDestinations] as [path, label]}<Button
                variant={controller.state.route.path === path
                  ? "secondary"
                  : "ghost"}
                class="beancount-navigation__item"
                aria-current={controller.state.route.path === path
                  ? "page"
                  : undefined}
                onclick={() => navigate(path)}>{label}</Button
              >{/each}
          </nav>
        </div>
      {/snippet}
      {#snippet details()}<AiDock
          projectId={controller.state.snapshot?.project.id}
          projectName={controller.state.snapshot?.project.name ?? "Ledger"}
          hasProject={Boolean(controller.state.snapshot)}
          inlineRequest={controller.state.inlineAiRequest}
          onProjectChanged={controller.actions.refresh}
          onClose={() => {
            shell.right.close();
            shell.mobile.showMain();
          }}
        />{/snippet}
      {#snippet toolbar()}<IngestionHeaderActions
          region="leading"
        /><IngestionHeaderActions />{/snippet}
      {#snippet content()}
        {#if controller.state.error}<div role="alert" class="p-4">
            {controller.state.error}<Button
              onclick={() => controller.actions.retry().catch(() => {})}
              >Retry</Button
            >
          </div>
        {:else if controller.state.status === "loading" || controller.state.status === "idle"}<div
            role="status"
            class="p-4"
          >
            Loading ledger…
          </div>
        {:else if controller.state.status === "empty"}<div class="p-4">
            No ledger files
          </div>
        {:else}<div
            role="region"
            aria-label={routeTitle(controller.state.route)}
            use:routerLinks
          >
            {#key controller.state.route.path}
              {#if controller.state.route.path === "/dashboard"}<FinancialDashboard
                />
              {:else if controller.state.route.path === "/income_statement"}<IncomeStatement
                />
              {:else if controller.state.route.path === "/balance_sheet"}<BalanceSheet
                />
              {:else if controller.state.route.path === "/trial_balance"}<TrialBalance
                />
              {:else if controller.state.route.path === "/holdings"}<Holdings />
              {:else if controller.state.route.path === "/statistics"}<Statistics
                />
              {:else if controller.state.route.path === "/errors"}<Errors />
              {:else if controller.state.route.path === "/journal"}<JournalTable
                />
              {:else if controller.state.route.path === "/accounts" || controller.state.route.params.account}<AccountDetails
                  account={controller.state.route.params.account ?? ""}
                />
              {:else if controller.state.route.path === "/editor" || controller.state.route.path === "/directives"}<Editor
                />
              {:else if controller.state.route.path === "/query"}<Query />
              {:else if controller.state.route.path === "/resource"}<ResourceViewer
                />
              {:else if controller.state.route.path === "/records"}<IngestionTable
                />{:else if controller.state.route.path === "/import/editor"}<IngestionConfigEditor
                />{:else if controller.state.route.path === "/import/accounts"}<IngestionAccountsSetup
                />{:else if controller.state.route.path === "/import/merchants"}<IngestionMerchantReview
                />{:else if controller.state.route.path === "/import/manage-merchants"}<IngestionMerchantManage
                />{:else if controller.state.route.path === "/import/brands"}<IngestionBrandSettings
                />{:else if controller.state.route.path === "/import/history"}<IngestionRunHistory
                />{:else if controller.state.route.path === "/import/rules"}<RulesSettings
                />{:else if controller.state.route.params.runId}<IngestionRunAudit
                />{:else}<p class="p-4">Page not found</p>{/if}
            {/key}
          </div>
          <JournalRecordRouteSheet />{/if}
      {/snippet}
    </BeancountAppShell>
  </Tooltip.Provider>
</div>

<style>
  .beancount-navigation {
    display: grid;
    gap: 0.75rem;
    padding: 0.5rem;
  }
  .beancount-navigation nav {
    display: grid;
    gap: 0.125rem;
  }
  :global(.beancount-navigation__item) {
    width: 100%;
    justify-content: flex-start;
  }
</style>
