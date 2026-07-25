<script lang="ts">
  import type { Snippet } from "svelte";
  import ContentScrollArea from "../layout/ContentScrollArea.svelte";
  import ChartSwitcher from "../charts/ChartSwitcher.svelte";
  import * as Breadcrumb from "../shadcn/breadcrumb";
  import * as Tabs from "../shadcn/tabs";

  export type AccountDetailsChart = {
    id: string;
    label: string;
  };

  export type AccountDetailsTab = {
    id: string;
    label: string;
  };

  export type AccountDetailsBreadcrumb = {
    label: string;
    href?: string;
    /** Explicitly render as current page text when there is no destination. */
    isPage?: boolean;
  };

  let {
    account,
    breadcrumbs,
    charts,
    activeChartId,
    activeTab = "account-table",
    onActiveChartChange,
    onActiveTabChange,
    tabs,
    chartChildren,
    accountChildren,
    changesChildren,
    balancesChildren,
    chartSwitcherAriaLabel = "Account chart",
  }: {
    account: string;
    breadcrumbs: readonly AccountDetailsBreadcrumb[];
    charts: readonly AccountDetailsChart[];
    activeChartId: string;
    activeTab?: string;
    onActiveChartChange?: (chartId: string) => void;
    onActiveTabChange?: (tabId: string) => void;
    tabs: readonly AccountDetailsTab[];
    chartChildren?: Snippet<[string]>;
    accountChildren?: Snippet;
    changesChildren?: Snippet;
    balancesChildren?: Snippet;
    chartSwitcherAriaLabel?: string;
  } = $props();

  const normalizedActiveChartId = $derived(
    charts.some((chart) => chart.id === activeChartId) && activeChartId
      ? activeChartId
      : charts[0]?.id ?? "",
  );

  const activeTabOrFirst = $derived(
    tabs.some((tab) => tab.id === activeTab) && activeTab
      ? activeTab
      : tabs[0]?.id ?? "",
  );

  function handleTabChange(value: string | undefined) {
    if (!value) return;
    onActiveTabChange?.(value);
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <Breadcrumb.Root class="w-full shrink-0 p-3">
    <Breadcrumb.List>
      {#each breadcrumbs as breadcrumb, index (breadcrumb.label)}
        <Breadcrumb.Item>
          {#if breadcrumb.href && !breadcrumb.isPage}
            <Breadcrumb.Link href={breadcrumb.href}>
              {breadcrumb.label}
            </Breadcrumb.Link>
          {:else}
            <Breadcrumb.Page>{breadcrumb.label}</Breadcrumb.Page>
          {/if}
        </Breadcrumb.Item>
        {#if index + 1 < breadcrumbs.length}
          <Breadcrumb.Separator />
        {/if}
      {/each}
    </Breadcrumb.List>
  </Breadcrumb.Root>

  <ContentScrollArea class="min-h-0 flex-1" contentClass="scroll-container">
    <div class="p-2">
      <ChartSwitcher
        charts={charts}
        activeChartId={normalizedActiveChartId}
        ariaLabel={chartSwitcherAriaLabel}
        onActiveChartChange={onActiveChartChange}
      >
        {#if chartChildren}
          {#snippet children(chartId)}
            {@render chartChildren(chartId)}
          {/snippet}
        {/if}
      </ChartSwitcher>
    </div>

    <div class="min-w-0 max-w-full p-2">
      <div class="flex min-w-0 max-w-full">
        <div class="w-full min-w-0 max-w-full">
          <Tabs.Root
            value={activeTabOrFirst}
            onValueChange={handleTabChange}
            class="min-w-0 max-w-full pt-2"
          >
            <Tabs.List>
              {#each tabs as tab (tab.id)}
                <Tabs.Trigger value={tab.id}>{tab.label}</Tabs.Trigger>
              {/each}
            </Tabs.List>

            {#each tabs as tab (tab.id)}
              <Tabs.Content value={tab.id}>
                {#if tab.id === "account-table"}
                  {#if accountChildren}
                    {@render accountChildren()}
                  {:else}
                    <div
                      class="rounded-md border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground"
                    >
                      No account table content is configured for {account}.
                    </div>
                  {/if}
                {:else if tab.id === "changes"}
                  {#if changesChildren}
                    {@render changesChildren()}
                  {:else}
                    <div
                      class="rounded-md border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground"
                    >
                      No changes table is configured.
                    </div>
                  {/if}
                {:else if tab.id === "balances"}
                  {#if balancesChildren}
                    {@render balancesChildren()}
                  {:else}
                    <div
                      class="rounded-md border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground"
                    >
                      No balances table is configured.
                    </div>
                  {/if}
                {:else}
                  <div
                    class="rounded-md border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground"
                  >
                    No content is configured for {tab.label}.
                  </div>
                {/if}
              </Tabs.Content>
            {/each}
          </Tabs.Root>
        </div>
      </div>
    </div>
  </ContentScrollArea>
</div>
