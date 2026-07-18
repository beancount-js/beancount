<script lang="ts">
  import AppShell from "./AppShell.svelte";

  const navigationItems = ["Overview", "Transactions", "Accounts", "Reports"];

  let activeView = $state("Transactions");
  let syncInProgress = $state(false);

  const selectView = (view: string) => {
    activeView = view;
  };
</script>

<div class="h-[42rem] overflow-hidden rounded-lg border border-border">
  <AppShell pageTitle={activeView} height="container" hasSidebar>
    <svelte:fragment slot="sidebar">
      <aside
        aria-label="Ledger navigation"
        class="flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 text-sidebar-foreground"
      >
        <div class="border-b border-sidebar-border pb-3">
          <p class="text-sm font-semibold">Northstar Ledger</p>
          <p class="mt-1 text-xs text-muted-foreground">
            personal-2026.beancount
          </p>
        </div>
        <nav class="mt-4 flex flex-col gap-1" aria-label="Workspace">
          {#each navigationItems as item}
            <button
              type="button"
              class={activeView === item
                ? "rounded-md border border-sidebar-border bg-background px-2 py-2 text-left text-sm font-medium shadow-sm"
                : "rounded-md px-2 py-2 text-left text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}
              aria-current={activeView === item ? "page" : undefined}
              onclick={() => selectView(item)}
            >
              {item}
            </button>
          {/each}
        </nav>
        <div class="mt-auto border-t border-sidebar-border pt-3">
          <p class="px-2 text-xs text-muted-foreground">Last synced just now</p>
        </div>
      </aside>
    </svelte:fragment>

    <svelte:fragment slot="title-trailing">
      {#if activeView === "Transactions"}
        <span
          class="ml-1.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
          >3</span
        >
      {/if}
    </svelte:fragment>

    <svelte:fragment slot="header-actions">
      <button
        type="button"
        class="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onclick={() => (syncInProgress = !syncInProgress)}
      >
        {syncInProgress ? "Pause sync" : "Sync ledger"}
      </button>
      <button
        type="button"
        class="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        onclick={() => selectView("Transactions")}
      >
        New transaction
      </button>
    </svelte:fragment>

    <svelte:fragment slot="status">
      {#if syncInProgress}
        <div
          class="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          role="status"
        >
          <span class="size-2 animate-pulse rounded-full bg-primary"></span>
          Syncing Barclays checking account…
        </div>
      {/if}
    </svelte:fragment>

    <section
      class="h-full overflow-auto p-5"
      aria-label={`${activeView} content`}
    >
      <p class="text-sm text-muted-foreground">Viewing</p>
      <h1 class="mt-1 text-xl font-semibold">{activeView}</h1>
      <div class="mt-5 overflow-hidden rounded-lg border border-border">
        <div
          class="grid grid-cols-[8rem_minmax(0,1fr)_7rem] border-b border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground"
        >
          <span>Date</span>
          <span>Description</span>
          <span class="text-right">Amount</span>
        </div>
        <div class="grid grid-cols-[8rem_minmax(0,1fr)_7rem] px-3 py-3 text-sm">
          <span>18 Jul 2026</span>
          <span>Groceries</span>
          <span class="text-right tabular-nums">£42.17</span>
        </div>
      </div>
    </section>
  </AppShell>
</div>
