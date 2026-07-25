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
      : (charts[0]?.id ?? ""),
  );

  const activeTabOrFirst = $derived(
    tabs.some((tab) => tab.id === activeTab) && activeTab
      ? activeTab
      : (tabs[0]?.id ?? ""),
  );

  function handleTabChange(value: string | undefined) {
    if (!value) return;
    onActiveTabChange?.(value);
  }
</script>

<div class="cn-pages-accountdetails-73-1">
  <Breadcrumb.Root class="cn-pages-accountdetails-74-1">
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

  <ContentScrollArea
    class="cn-pages-accountdetails-93-1"
    contentClass="scroll-container"
  >
    <div class="cn-pages-accountdetails-94-1">
      <ChartSwitcher
        {charts}
        activeChartId={normalizedActiveChartId}
        ariaLabel={chartSwitcherAriaLabel}
        {onActiveChartChange}
      >
        {#snippet children(chartId)}
          {#if chartChildren}
            {@render chartChildren(chartId)}
          {/if}
        {/snippet}
      </ChartSwitcher>
    </div>

    <div class="cn-pages-accountdetails-109-1">
      <div class="cn-pages-accountdetails-110-1">
        <div class="cn-pages-accountdetails-111-1">
          <Tabs.Root
            value={activeTabOrFirst}
            onValueChange={handleTabChange}
            class="cn-pages-accountdetails-115-1"
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
                    <div class="cn-pages-accountdetails-130-1">
                      No account table content is configured for {account}.
                    </div>
                  {/if}
                {:else if tab.id === "changes"}
                  {#if changesChildren}
                    {@render changesChildren()}
                  {:else}
                    <div class="cn-pages-accountdetails-140-1">
                      No changes table is configured.
                    </div>
                  {/if}
                {:else if tab.id === "balances"}
                  {#if balancesChildren}
                    {@render balancesChildren()}
                  {:else}
                    <div class="cn-pages-accountdetails-150-1">
                      No balances table is configured.
                    </div>
                  {/if}
                {:else}
                  <div class="cn-pages-accountdetails-157-1">
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
