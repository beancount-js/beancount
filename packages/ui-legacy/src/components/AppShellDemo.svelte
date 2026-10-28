<script lang="ts">
  import AppShell from "./AppShell.svelte";

  const navigationItems = ["Overview", "Transactions", "Accounts", "Reports"];

  let activeView = $state("Transactions");
  let syncInProgress = $state(false);

  const selectView = (view: string) => {
    activeView = view;
  };
</script>

<div class="cn-root-appshelldemo-14-1">
  <AppShell pageTitle={activeView} height="container" hasSidebar>
    <svelte:fragment slot="sidebar">
      <aside aria-label="Ledger navigation" class="cn-root-appshelldemo-19-1">
        <div class="cn-root-appshelldemo-21-1">
          <p class="cn-root-appshelldemo-22-1">Northstar Ledger</p>
          <p class="cn-root-appshelldemo-23-1">personal-2026.beancount</p>
        </div>
        <nav class="cn-root-appshelldemo-27-1" aria-label="Workspace">
          {#each navigationItems as item}
            <button
              type="button"
              class={activeView === item
                ? "cn-root-appshelldemo-32-1"
                : "cn-root-appshelldemo-33-1"}
              aria-current={activeView === item ? "page" : undefined}
              onclick={() => selectView(item)}
            >
              {item}
            </button>
          {/each}
        </nav>
        <div class="cn-root-appshelldemo-41-1">
          <p class="cn-root-appshelldemo-42-1">Last synced just now</p>
        </div>
      </aside>
    </svelte:fragment>

    <svelte:fragment slot="title-trailing">
      {#if activeView === "Transactions"}
        <span class="cn-root-appshelldemo-50-1">3</span>
      {/if}
    </svelte:fragment>

    <svelte:fragment slot="header-actions">
      <button
        type="button"
        class="cn-root-appshelldemo-59-1"
        onclick={() => (syncInProgress = !syncInProgress)}
      >
        {syncInProgress ? "Pause sync" : "Sync ledger"}
      </button>
      <button
        type="button"
        class="cn-root-appshelldemo-66-1"
        onclick={() => selectView("Transactions")}
      >
        New transaction
      </button>
    </svelte:fragment>

    <svelte:fragment slot="status">
      {#if syncInProgress}
        <div class="cn-root-appshelldemo-76-1" role="status">
          <span class="cn-root-appshelldemo-79-1"></span>
          Syncing Barclays checking account…
        </div>
      {/if}
    </svelte:fragment>

    <section
      class="cn-root-appshelldemo-86-1"
      aria-label={`${activeView} content`}
    >
      <p class="cn-root-appshelldemo-89-1">Viewing</p>
      <h1 class="cn-root-appshelldemo-90-1">{activeView}</h1>
      <div class="cn-root-appshelldemo-91-1">
        <div class="cn-root-appshelldemo-93-1">
          <span>Date</span>
          <span>Description</span>
          <span class="cn-root-appshelldemo-97-1">Amount</span>
        </div>
        <div class="cn-root-appshelldemo-99-1">
          <span>18 Jul 2026</span>
          <span>Groceries</span>
          <span class="cn-root-appshelldemo-102-1">£42.17</span>
        </div>
      </div>
    </section>
  </AppShell>
</div>
