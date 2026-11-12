<script lang="ts">
  import FilterCommandPicker from "../forms/FilterCommandPicker.svelte";

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
  import BeancountNavigation from "../navigation/BeancountNavigation.svelte";
  import ResourceViewer from "../../domain/components/ResourceViewer.svelte";
  import JournalRecordRouteSheet from "../../domain/components/JournalRecordRouteSheet.svelte";
  import IngestionHeaderActions from "../../domain/components/IngestionHeaderActions.svelte";
  import {
    setContext,
    onMount,
    onDestroy,
    untrack,
    type Snippet,
  } from "svelte";
  import {
    AppShellController,
    createLocalStorageAppShellLayoutPersistence,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";

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
    details,
    detailsLabel = "Details",
    detailsTitle = "Details",
    detailsMobileLabel = "Details",
  }: {
    controller: BeancountController;
    displayMode?: AppShellDisplayMode;
    layoutStorage?: Storage;
    /** Optional host-owned panel for future application extensions. */
    details?: Snippet;
    detailsLabel?: string;
    detailsTitle?: string;
    detailsMobileLabel?: string;
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
  function resetRouteScroll(node: HTMLElement) {
    const frame = requestAnimationFrame(() => {
      const routeContent =
        node.closest<HTMLElement>('[data-ui-part="body-content"]') ?? node;
      for (const element of [
        routeContent,
        ...routeContent.querySelectorAll<HTMLElement>("*"),
      ]) {
        const overflowY = getComputedStyle(element).overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          element.scrollTop !== 0
        ) {
          element.scrollTop = 0;
        }
      }
    });
    return {
      destroy() {
        cancelAnimationFrame(frame);
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
      projectName={controller.state.snapshot?.project.name ??
        "Beancount Studio"}
      onOpenSettings={() => controller.actions.openSettings()}
      canNavigateBack={controller.state.canNavigateBack}
      canNavigateForward={controller.state.canNavigateForward}
      onBack={controller.actions.back}
      onForward={controller.actions.forward}
      {details}
      {detailsLabel}
      {detailsTitle}
      {detailsMobileLabel}
    >
      {#snippet navigation()}
        <BeancountNavigation
          {controller}
          onNavigate={() => shell.mobile.showMain()}
        />
      {/snippet}
      {#snippet toolbarLeading()}<IngestionHeaderActions
          region="leading"
        />{/snippet}
      {#snippet toolbar()}<IngestionHeaderActions />{/snippet}
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
            class="beancount-route-content"
            data-settings={controller.state.sidebar.settings}
            aria-label={routeTitle(controller.state.route)}
            use:routerLinks
          >
            {#key `${controller.state.snapshot?.project.id}:${controller.state.route.path}:${controller.state.activeFile}`}
              <div class="contents" data-route-frame use:resetRouteScroll>
                {#if controller.state.route.path === "/dashboard"}<FinancialDashboard
                  />
                {:else if controller.state.route.path === "/income_statement"}<IncomeStatement
                  />
                {:else if controller.state.route.path === "/balance_sheet"}<BalanceSheet
                  />
                {:else if controller.state.route.path === "/trial_balance"}<TrialBalance
                  />
                {:else if controller.state.route.path === "/holdings"}<Holdings
                  />
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
              </div>
            {/key}
          </div>
          <JournalRecordRouteSheet />{/if}
      {/snippet}
    </BeancountAppShell>
  </Tooltip.Provider>
</div>

<style>
  .beancount-route-content {
    display: flex;
    flex: 1;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .beancount-route-content[data-settings="true"] {
    --cv-search-filter-max-width: 100%;
  }
  .beancount-route-content[data-settings="true"]
    :global(.cv-search-filter-bar__content),
  .beancount-route-content[data-settings="true"]
    :global(.cv-search-filter-input),
  .beancount-route-content[data-settings="true"]
    :global(.cv-search-filter-bar__search-pill) {
    width: 100%;
    max-width: none;
    min-width: 0;
  }
  .beancount-route-content[data-settings="true"]
    :global(.cv-search-filter-input) {
    flex: 1;
  }
</style>
