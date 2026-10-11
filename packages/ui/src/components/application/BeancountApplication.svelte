<script lang="ts">
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
  import FinancialDashboard from "../../domain/components/FinancialDashboard.svelte";
  import BeancountAppShell from "../app-shell/BeancountAppShell.svelte";
  import type { BeancountController } from "../../controller";
  import { ledgerDestinations, routeTitle } from "../../controller";
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
</script>

<div
  class="beancount-application"
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
          <nav aria-label="Ledger reports">
            {#each ledgerDestinations.filter(([path]) => path === "/dashboard") as [path, label]}<Button
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
            <FinancialDashboard />
          </div>{/if}
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
