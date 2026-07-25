<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";
  import AccountDetails, {
    type AccountDetailsTab,
  } from "./AccountDetails.svelte";

  const { Story } = defineMeta({
    title: "Pages/Account Details",
    component: AccountDetails,
    parameters: {
      layout: "fullscreen",
      docs: {
        description: {
          component:
            "Reusable account-details page composition. The application supplies prepared chart summaries, tab labels, breadcrumb model, and route callbacks; the UI component owns chart switcher, breadcrumb, and tab layout.",
        },
      },
    },
  });

  const breadcrumbItems = [
    { label: "Journal", href: "/journal" },
    { label: "Expenses", href: "/accounts/Expenses" },
    { label: "Expenses:Groceries", isPage: true },
  ];

  const charts = [
    { id: "Account Balance", label: "Account Balance" },
    { id: "Changes", label: "Monthly Changes" },
    { id: "All", label: "All" },
  ];

  const tabs: AccountDetailsTab[] = [
    { id: "account-table", label: "Account Table" },
    { id: "changes", label: "Changes (Month)" },
    { id: "balances", label: "Balances (Month)" },
  ];
</script>

<script lang="ts">
  let selectedChartId = $state("Account Balance");
  let activeTab = $state("account-table");
  let status = $state("active");
</script>

<Story
  name="Switches chart and tabs"
  play={async ({ canvas }) => {
    const accountTab = canvas.getByRole("tab", { name: "Account Table" });
    const changesTab = canvas.getByRole("tab", { name: "Changes (Month)" });
    const chartSelector = canvas.getByRole("tab", { name: "Monthly Changes" });
    await userEvent.click(changesTab);
    await expect(changesTab).toHaveAttribute("data-state", "active");
    await expect(accountTab).toHaveAttribute("data-state", "inactive");
    await userEvent.click(chartSelector);
    await expect(canvas.getByText("Active chart: Monthly Changes")).toBeVisible();
  }}
>
  {#snippet template()}
    <div class="h-[40rem] rounded-xl border bg-background p-4 shadow-sm">
      <AccountDetails
        account="Expenses:Groceries"
        breadcrumbs={breadcrumbItems}
        charts={charts}
        activeChartId={selectedChartId}
        {tabs}
        activeTab={activeTab}
        onActiveChartChange={(next) => {
          selectedChartId = next;
          status = `Active chart: ${next}`;
        }}
        onActiveTabChange={(next) => {
          activeTab = next;
          status = `Active tab: ${next}`;
        }}
      >
        {#snippet chartChildren(activeChartId)}
          <div class="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Chart: {activeChartId}
          </div>
        {/snippet}
        {#snippet accountChildren()}
          <div class="rounded-md border bg-card p-4 text-sm">
            Account table content for Expenses:Groceries
          </div>
        {/snippet}
        {#snippet changesChildren()}
          <div class="rounded-md border bg-card p-4 text-sm">
            Changes table content for selected period
          </div>
        {/snippet}
        {#snippet balancesChildren()}
          <div class="rounded-md border bg-card p-4 text-sm">
            Balance table content for selected period
          </div>
        {/snippet}
      </AccountDetails>
      <output class="sr-only" aria-live="polite">{status}</output>
    </div>
  {/snippet}
</Story>
